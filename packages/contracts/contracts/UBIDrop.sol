// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PassportBoundNFT} from "./PassportBoundNFT.sol";
import {OApp} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import {OptionsBuilder} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import {
    AddressCast
} from "@layerzerolabs/lz-evm-protocol-v2/contracts/libs/AddressCast.sol";
import {
    ILayerZeroEndpointV2,
    MessagingFee,
    Origin
} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";

/// @title UBIDrop
/// @notice Manages UBI currency drops whose eligibility is defined by PassportBoundNFT holders.
contract UBIDrop is OApp {
    using SafeERC20 for IERC20;
    using OptionsBuilder for bytes;

    uint8 private constant MESSAGE_TYPE_REQUEST = 1;
    uint8 private constant MESSAGE_TYPE_RESPONSE = 2;

    struct Drop {
        /// @notice Merkle root of eligible accounts
        bytes32 merkleRoot;
        /// @notice Total number of eligible accounts
        uint256 n;
        /// @notice ERC20 distributed by the drop
        address currency;
        /// @notice Total amount to distribute
        uint256 amount;
        /// @notice Indicates the drop has an associated Merkle root
        bool ready;
    }

    /// @notice PassportBoundNFT address (only used when contracts share a chain)
    address payable public immutable passportBoundNft;
    /// @notice Local endpoint ID
    uint32 public immutable localEid;
    /// @notice Endpoint ID where PassportBoundNFT lives
    uint32 public passportChainEid;
    /// @notice LayerZero execution options for requesting a root
    bytes public requestOptions;

    /// @notice Drop data
    mapping(uint256 dropId => Drop drop) public drops;
    /// @notice Drop claimed data
    mapping(uint256 dropId => mapping(bytes32 leaf => bool claimed))
        public isClaimed;
    /// @notice Tracks pending remote root fetches
    mapping(uint256 dropId => bool pending) public pendingDrops;
    /// @notice Total number of drops defined
    uint256 public totalDrops;

    event DropRequested(
        uint256 indexed dropId,
        address indexed currency,
        uint256 amount
    );
    event DropAdded(
        uint256 indexed dropId,
        bytes32 indexed merkleRoot,
        uint256 n,
        address currency,
        uint256 amount
    );
    event Claimed(
        address indexed recipient,
        uint256 indexed tokenId,
        uint256 indexed dropId,
        uint256 amount
    );
    event DropRequestQueued(
        uint256 indexed dropId,
        uint32 indexed dstEid,
        bytes options
    );
    event PassportPeerUpdated(uint32 indexed eid, address indexed peer);
    event RequestOptionsUpdated(bytes options);

    error DropNotFound();
    error AlreadyClaimed();
    error InvalidProof();
    error DropNotReady(uint256 dropId);
    error DropPending(uint256 dropId);
    error InvalidAmount();
    error InvalidCurrency();
    error EmptyMerkleTree();
    error InsufficientLayerZeroFee(uint256 required, uint256 provided);
    error InvalidMessageType(uint8 messageType);
    error UnexpectedMsgValue();

    constructor(
        address payable passportBoundNft_,
        address endpoint,
        uint32 passportChainEid_
    ) OApp(endpoint, msg.sender) Ownable(msg.sender) {
        passportBoundNft = passportBoundNft_;
        passportChainEid = passportChainEid_;
        localEid = ILayerZeroEndpointV2(endpoint).eid();
        requestOptions = OptionsBuilder.newOptions().addExecutorLzReceiveOption(
            200_000,
            0
        );
    }

    /// @notice Configure the trusted peer for the PassportBoundNFT contract and store its endpoint id.
    function setPassportPeer(
        uint32 eid,
        address peer
    ) external onlyOwner {
        _setPeer(eid, AddressCast.toBytes32(peer));
        passportChainEid = eid;
        emit PassportPeerUpdated(eid, peer);
    }

    /// @notice Update default LayerZero execution options for root requests.
    function setRequestOptions(bytes calldata options) external onlyOwner {
        if (options.length == 0) {
            requestOptions = OptionsBuilder
                .newOptions()
                .addExecutorLzReceiveOption(200_000, 0);
        } else {
            requestOptions = options;
        }
        emit RequestOptionsUpdated(requestOptions);
    }

    /// @notice Quote the fee required to request a Merkle root update.
    function quoteRequestFee(
        bytes calldata optionsOverride
    ) external view returns (uint256 nativeFee, uint256 lzTokenFee) {
        if (passportChainEid == localEid) {
            return (0, 0);
        }
        bytes memory opts;
        if (optionsOverride.length == 0) {
            opts = requestOptions;
        } else {
            opts = optionsOverride;
        }
        bytes memory payload = abi.encode(uint8(MESSAGE_TYPE_REQUEST), uint256(0));
        MessagingFee memory fee = _quote(
            passportChainEid,
            payload,
            opts,
            false
        );
        return (fee.nativeFee, fee.lzTokenFee);
    }

    function _getMerkleTree()
        internal
        view
        virtual
        returns (bytes32 root, uint256 n)
    {
        root = PassportBoundNFT(passportBoundNft).merkleRoot();
        n = PassportBoundNFT(passportBoundNft).totalSupply();
    }

    /// @notice Create a UBI drop/campaign
    /// @param currency Address of ERC-20 that drop is denominated in
    /// @param amount Total amount of currency to drop in this campaign (will
    ///     be pulled from the caller's account)
    function addDrop(
        address currency,
        uint256 amount
    ) external payable returns (uint256 dropId) {
        return _addDrop(currency, amount, requestOptions);
    }

    /// @notice Create a drop using custom LayerZero executor options.
    function addDropWithOptions(
        address currency,
        uint256 amount,
        bytes calldata options
    ) external payable returns (uint256 dropId) {
        return _addDrop(currency, amount, options);
    }

    /// @notice Claim a UBI drop (for anyone)
    /// @param recipient Address of the recipient
    /// @param tokenId Token ID of the NFT
    /// @param dropId Drop ID
    /// @param proof Merkle proof of the claim
    function claim(
        address recipient,
        uint256 tokenId,
        uint256 dropId,
        bytes32[] memory proof
    ) external {
        Drop memory drop = drops[dropId];
        if (drop.currency == address(0)) revert DropNotFound();
        if (!drop.ready) revert DropNotReady(dropId);

        bytes32 leaf = keccak256(abi.encode(recipient, tokenId));
        require(!isClaimed[dropId][leaf], AlreadyClaimed());
        isClaimed[dropId][leaf] = true; // nullify leaf

        require(
            MerkleProof.verify(proof, drop.merkleRoot, leaf),
            InvalidProof()
        );

        // interactions: transfer currency to recipient
        // TODO: Potential dust leftover due to rounding
        uint256 amt = drop.amount / drop.n;
        IERC20(drop.currency).safeTransfer(recipient, amt);
        emit Claimed(recipient, tokenId, dropId, amt);
    }

    function _addDrop(
        address currency,
        uint256 amount,
        bytes memory options
    ) internal returns (uint256 dropId) {
        if (currency == address(0)) revert InvalidCurrency();
        if (amount == 0) revert InvalidAmount();

        dropId = ++totalDrops;
        drops[dropId] = Drop({
            merkleRoot: bytes32(0),
            n: 0,
            currency: currency,
            amount: amount,
            ready: false
        });

        IERC20(currency).safeTransferFrom(msg.sender, address(this), amount);
        emit DropRequested(dropId, currency, amount);

        if (passportChainEid == localEid) {
            if (msg.value != 0) revert UnexpectedMsgValue();
            (bytes32 root, uint256 n) = _getMerkleTree();
            _finalizeDrop(dropId, root, n);
        } else {
            _requestMerkleRoot(dropId, options);
        }
    }

    function _requestMerkleRoot(uint256 dropId, bytes memory options) internal {
        if (pendingDrops[dropId]) revert DropPending(dropId);
        pendingDrops[dropId] = true;

        bytes memory opts = options.length == 0 ? requestOptions : options;
        bytes memory payload = abi.encode(uint8(MESSAGE_TYPE_REQUEST), dropId);
        MessagingFee memory quoteFee = _quote(
            passportChainEid,
            payload,
            opts,
            false
        );
        if (msg.value < quoteFee.nativeFee) {
            revert InsufficientLayerZeroFee(quoteFee.nativeFee, msg.value);
        }
        MessagingFee memory fee = MessagingFee(msg.value, 0);
        _lzSend(
            passportChainEid,
            payload,
            opts,
            fee,
            payable(msg.sender)
        );
        emit DropRequestQueued(dropId, passportChainEid, opts);
    }

    function _lzReceive(
        Origin calldata,
        bytes32,
        bytes calldata message,
        address,
        bytes calldata
    ) internal override {
        uint8 messageType = uint8(bytes1(message));
        if (messageType != MESSAGE_TYPE_RESPONSE) {
            revert InvalidMessageType(messageType);
        }
        (uint256 dropId, bytes32 root, uint256 n) = abi.decode(
            message[1:],
            (uint256, bytes32, uint256)
        );
        _finalizeDrop(dropId, root, n);
    }

    function _finalizeDrop(
        uint256 dropId,
        bytes32 root,
        uint256 n
    ) internal {
        Drop storage drop = drops[dropId];
        if (drop.currency == address(0)) revert DropNotFound();
        if (n == 0) revert EmptyMerkleTree();

        drop.merkleRoot = root;
        drop.n = n;
        drop.ready = true;
        pendingDrops[dropId] = false;

        emit DropAdded(dropId, root, n, drop.currency, drop.amount);
    }
}
