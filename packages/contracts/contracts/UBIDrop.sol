// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {PassportBoundNFT} from "./PassportBoundNFT.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title UBIDrop
contract UBIDrop {
    using SafeERC20 for IERC20;

    struct Drop {
        /// @notice Merkle root of the NFTs
        bytes32 merkleRoot;
        /// @notice Total supply of the NFTs
        uint256 n;
        /// @notice
        address currency;
        /// @notice Total amount of currency to be distributed in this drop
        uint256 amount;
    }

    /// @notice Drop data
    mapping(uint256 dropId => Drop drop) public drops;
    /// @notice Drop claimed data
    mapping(uint256 dropId => mapping(bytes32 leaf => bool claimed))
        public isClaimed;
    /// @notice Total number of drops defined
    uint256 public totalDrops;
    /// @notice PassportBoundNFT address
    address passportBoundNft;

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

    error DropNotFound();
    error AlreadyClaimed();
    error InvalidProof();

    constructor(address passportBoundNft_) {
        passportBoundNft = passportBoundNft_;
    }

    function _getMerkleTree()
        internal
        virtual
        returns (bytes32 root, uint256 n)
    {
        root = PassportBoundNFT(passportBoundNft).merkleRoot();
        n = PassportBoundNFT(passportBoundNft).totalSupply();
    }

    /// @notice Create a UBI drop/campaign
    /// @param currency Address of ERC-20 that drop is denominated in
    /// @param amount Total amount of currency to drop in this campaign
    function addDrop(address currency, uint256 amount) external {
        (bytes32 root, uint256 n) = _getMerkleTree();
        uint256 dropId = ++totalDrops;
        drops[dropId] = Drop({
            merkleRoot: root,
            n: n,
            currency: currency,
            amount: amount
        });
        emit DropAdded(dropId, root, n, currency, amount);
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
        require(drop.merkleRoot != bytes32(0), DropNotFound());

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
}
