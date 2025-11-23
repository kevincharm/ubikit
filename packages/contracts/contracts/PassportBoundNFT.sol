// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SelfVerificationRoot} from "@selfxyz/contracts/contracts/abstract/SelfVerificationRoot.sol";
import {ISelfVerificationRoot} from "@selfxyz/contracts/contracts/interfaces/ISelfVerificationRoot.sol";
import {SelfStructs} from "@selfxyz/contracts/contracts/libraries/SelfStructs.sol";
import {SelfUtils} from "@selfxyz/contracts/contracts/libraries/SelfUtils.sol";
import {IIdentityVerificationHubV2} from "@selfxyz/contracts/contracts/interfaces/IIdentityVerificationHubV2.sol";
import {ERC721, ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {MerkleTree} from "@openzeppelin/contracts/utils/structs/MerkleTree.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
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

/// @title PassportBoundNFT
contract PassportBoundNFT is SelfVerificationRoot, ERC721Enumerable, OApp {
    using MerkleTree for MerkleTree.Bytes32PushTree;
    using OptionsBuilder for bytes;

    uint8 private constant MESSAGE_TYPE_REQUEST = 1;
    uint8 private constant MESSAGE_TYPE_RESPONSE = 2;

    struct PassportData {
        uint256 userId;
        uint256 olderThan;
        string issuingState;
        string expiryDate; // ISODate?
    }

    /// @notice Verification config ID
    bytes32 public immutable verificationConfigId;
    /// @notice keccak(issuing_state)
    bytes32 public immutable issuingStateHash;

    /// @notice nullifier -> passport mapping
    mapping(uint256 nullifier => PassportData passportData) public passportData;
    /// @notice tokenId -> nullifier mapping
    mapping(uint256 tokenId => uint256 nullifier) public tokenIdToNullifier;
    /// @notice Merkle tree of NFTs
    MerkleTree.Bytes32PushTree public tree;
    /// @notice Merkle root
    bytes32 public merkleRoot;
    /// @notice Local LayerZero endpoint id
    uint32 public immutable endpointEid;
    /// @notice LayerZero options for responses
    bytes public responseOptions;

    event PassportMinted(uint256 indexed tokenId, uint256 indexed nullifier);
    event MerkleRootServed(
        uint32 indexed dstEid,
        uint256 indexed dropId,
        bytes32 merkleRoot,
        uint256 supply
    );
    event ResponseOptionsUpdated(bytes options);
    event NativeWithdrawn(address indexed to, uint256 amount);

    error InvalidUserIdentifier();
    error PassportAlreadyMinted();
    error InvalidIssuingState();
    error InvalidMessageType(uint8 messageType);
    error InsufficientLayerZeroBalance(uint256 required, uint256 balance);

    /// @notice Constructor for the test contract
    /// @param identityVerificationHubV2Address The address of the Identity Verification Hub V2
    /// @param scopeSeed The scope seed that is used to create the scope of the contract
    /// @param _verificationConfig The verification configuration that will be used to process the proof in the VerificationHub
    /// @param issuingState The issuing state of the passport that will be accepted by this contract
    /// @param layerZeroEndpoint Address of the LayerZero endpoint on this chain
    constructor(
        address identityVerificationHubV2Address,
        string memory scopeSeed,
        SelfUtils.UnformattedVerificationConfigV2 memory _verificationConfig,
        string memory issuingState,
        address layerZeroEndpoint
    )
        SelfVerificationRoot(identityVerificationHubV2Address, scopeSeed)
        ERC721("PassportBoundNFT", "PBNFT")
        OApp(layerZeroEndpoint, msg.sender)
        Ownable(msg.sender)
    {
        SelfStructs.VerificationConfigV2 memory config = SelfUtils
            .formatVerificationConfigV2(_verificationConfig);
        verificationConfigId = IIdentityVerificationHubV2(
            identityVerificationHubV2Address
        ).setVerificationConfigV2(config);

        merkleRoot = tree.setup(40 /** 1T */, bytes32(0));
        issuingStateHash = keccak256(bytes(issuingState));
        endpointEid = ILayerZeroEndpointV2(layerZeroEndpoint).eid();
        responseOptions = OptionsBuilder
            .newOptions()
            .addExecutorLzReceiveOption(200_000, 0);
    }

    /// @notice Configure the remote UBIDrop peer using an EVM address.
    function setRemoteDrop(uint32 eid, address peer) external onlyOwner {
        _setPeer(eid, AddressCast.toBytes32(peer));
    }

    /// @notice Update LayerZero response options.
    function setResponseOptions(bytes calldata options) external onlyOwner {
        if (options.length == 0) {
            responseOptions = OptionsBuilder
                .newOptions()
                .addExecutorLzReceiveOption(200_000, 0);
        } else {
            responseOptions = options;
        }
        emit ResponseOptionsUpdated(responseOptions);
    }

    /// @notice Withdraw native currency used to pay LayerZero messaging fees.
    function withdrawNative(address payable to, uint256 amount) external onlyOwner {
        (bool success, ) = to.call{value: amount}("");
        require(success, "PassportBoundNFT: withdraw failed");
        emit NativeWithdrawn(to, amount);
    }

    /// @notice Hook called after successful verification
    function customVerificationHook(
        ISelfVerificationRoot.GenericDiscloseOutputV2 memory output,
        bytes memory /** userDefinedData */
    ) internal override {
        require(output.userIdentifier != 0, InvalidUserIdentifier());
        require(
            passportData[output.nullifier].userId == 0,
            PassportAlreadyMinted()
        );
        require(
            keccak256(bytes(output.issuingState)) == issuingStateHash,
            InvalidIssuingState()
        );

        // TODO: Parse expiry date to timestamp
        passportData[output.nullifier] = PassportData({
            userId: output.userIdentifier,
            olderThan: output.olderThan,
            issuingState: output.issuingState,
            expiryDate: output.expiryDate
        });

        uint256 tokenId = totalSupply() + 1;
        // Map tokenId => nullifier => PassportData
        tokenIdToNullifier[tokenId] = output.nullifier;
        // Mint to recipient
        address recipient = address(uint160(output.userIdentifier));
        _mint(recipient, tokenId);
        // Leaf: (address, tokenId)
        // TODO: If NFT ever gets recovered to another address, this leaf must
        // be nullified.
        (uint256 index, bytes32 merkleRoot_) = tree.push(
            keccak256(abi.encode(recipient, tokenId))
        );
        assert(index == tokenId - 1);
        merkleRoot = merkleRoot_;
        emit PassportMinted(tokenId, output.nullifier);
    }

    function _lzReceive(
        Origin calldata origin,
        bytes32,
        bytes calldata message,
        address,
        bytes calldata
    ) internal override {
        uint8 messageType = uint8(bytes1(message));
        if (messageType != MESSAGE_TYPE_REQUEST) {
            revert InvalidMessageType(messageType);
        }
        uint256 dropId = abi.decode(message[1:], (uint256));
        _sendMerkleRoot(origin.srcEid, dropId);
    }

    function _sendMerkleRoot(uint32 dstEid, uint256 dropId) internal {
        bytes memory payload = abi.encode(
            uint8(MESSAGE_TYPE_RESPONSE),
            dropId,
            merkleRoot,
            totalSupply()
        );
        bytes memory options = responseOptions;
        MessagingFee memory fee = _quote(dstEid, payload, options, false);
        if (address(this).balance < fee.nativeFee) {
            revert InsufficientLayerZeroBalance(
                fee.nativeFee,
                address(this).balance
            );
        }
        _lzSend(dstEid, payload, options, fee, payable(address(this)));
        emit MerkleRootServed(dstEid, dropId, merkleRoot, totalSupply());
    }

    function _payNative(uint256 nativeFee) internal view override returns (uint256) {
        if (nativeFee == 0) return 0;
        if (address(this).balance < nativeFee) {
            revert InsufficientLayerZeroBalance(
                nativeFee,
                address(this).balance
            );
        }
        return nativeFee;
    }

    function getConfigId(
        bytes32 /** destinationChainId */,
        bytes32 /** userIdentifier */,
        bytes memory /** userDefinedData */
    ) public view override returns (bytes32) {
        return verificationConfigId;
    }

    receive() external payable {}
}
