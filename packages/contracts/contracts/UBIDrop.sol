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
        /// @notice Total supply of the NFTs
        uint256 totalSupply;
        /// @notice
        address currency;
        /// @notice Total amount of currency to be distributed in this drop
        uint256 amount;
    }

    /// @notice PassportBoundNFT address
    address public immutable passportBoundNft;

    /// @notice Drop data
    mapping(uint256 dropId => Drop drop) public drops;
    /// @notice Drop claimed data
    mapping(uint256 dropId => mapping(uint256 tokenId => bool claimed))
        public isClaimed;
    /// @notice Total number of drops defined
    uint256 public totalDrops;

    event DropAdded(
        uint256 indexed dropId,
        uint256 totalSupply,
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
    error NoSupply();
    error TokenIdNotIncluded();

    constructor(address passportBoundNft_) {
        passportBoundNft = passportBoundNft_;
    }

    /// @notice Create a UBI drop/campaign
    /// @param currency Address of ERC-20 that drop is denominated in
    /// @param amount Total amount of currency to drop in this campaign (will
    ///     be pulled from the caller's account)
    function addDrop(address currency, uint256 amount) external {
        uint256 dropId = ++totalDrops;
        uint256 totalSupply = PassportBoundNFT(passportBoundNft).totalSupply();
        require(totalSupply != 0, NoSupply());
        drops[dropId] = Drop({
            totalSupply: totalSupply,
            currency: currency,
            amount: amount
        });
        IERC20(currency).safeTransferFrom(msg.sender, address(this), amount);
        emit DropAdded(dropId, totalSupply, currency, amount);
    }

    /// @notice Claim a UBI drop (for anyone)
    /// @param tokenId Token ID of the NFT
    /// @param dropId Drop ID
    function claim(uint256 tokenId, uint256 dropId) external {
        Drop memory drop = drops[dropId];
        require(drop.totalSupply != 0, DropNotFound());
        require(tokenId <= drop.totalSupply, TokenIdNotIncluded());

        require(!isClaimed[dropId][tokenId], AlreadyClaimed());
        isClaimed[dropId][tokenId] = true; // nullify leaf

        address recipient = PassportBoundNFT(passportBoundNft).ownerOf(tokenId);
        // interactions: transfer currency to recipient
        // TODO: Potential dust leftover due to rounding
        uint256 amt = drop.amount / drop.totalSupply;
        IERC20(drop.currency).safeTransfer(recipient, amt);
        emit Claimed(recipient, tokenId, dropId, amt);
    }
}
