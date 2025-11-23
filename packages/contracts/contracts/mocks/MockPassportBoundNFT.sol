// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Minimal mock to emulate PassportBoundNFT surface used by UBIDrop
contract MockPassportBoundNFT {
    uint256 public immutable totalSupply;
    mapping(uint256 => address) private _owners;

    constructor(uint256 supply, address[] memory owners) {
        totalSupply = supply;
        for (uint256 i = 0; i < owners.length; i++) {
            _owners[i + 1] = owners[i];
        }
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        return _owners[tokenId];
    }

    function setOwner(uint256 tokenId, address owner) external {
        _owners[tokenId] = owner;
    }
}
