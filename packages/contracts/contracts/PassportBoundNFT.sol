// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SelfVerificationRoot} from "@selfxyz/contracts/contracts/abstract/SelfVerificationRoot.sol";
import {ISelfVerificationRoot} from "@selfxyz/contracts/contracts/interfaces/ISelfVerificationRoot.sol";
import {SelfStructs} from "@selfxyz/contracts/contracts/libraries/SelfStructs.sol";
import {SelfUtils} from "@selfxyz/contracts/contracts/libraries/SelfUtils.sol";
import {IIdentityVerificationHubV2} from "@selfxyz/contracts/contracts/interfaces/IIdentityVerificationHubV2.sol";
import {ERC721, ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {MerkleTree} from "@openzeppelin/contracts/utils/structs/MerkleTree.sol";

/// @title PassportBoundNFT
contract PassportBoundNFT is SelfVerificationRoot, ERC721Enumerable {
    using MerkleTree for MerkleTree.Bytes32PushTree;

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

    event PassportMinted(uint256 indexed tokenId, uint256 indexed nullifier);

    error InvalidUserIdentifier();
    error PassportAlreadyMinted();
    error InvalidIssuingState();

    /// @notice Constructor for the test contract
    /// @param identityVerificationHubV2Address The address of the Identity Verification Hub V2
    /// @param scopeSeed The scope seed that is used to create the scope of the contract
    /// @param _verificationConfig The verification configuration that will be used to process the proof in the VerificationHub
    /// @param issuingState The issuing state of the passport that will be accepted by this contract
    constructor(
        address identityVerificationHubV2Address,
        string memory scopeSeed,
        SelfUtils.UnformattedVerificationConfigV2 memory _verificationConfig,
        string memory issuingState
    )
        SelfVerificationRoot(identityVerificationHubV2Address, scopeSeed)
        ERC721("PassportBoundNFT", "PBNFT")
    {
        SelfStructs.VerificationConfigV2 memory config = SelfUtils
            .formatVerificationConfigV2(_verificationConfig);
        verificationConfigId = IIdentityVerificationHubV2(
            identityVerificationHubV2Address
        ).setVerificationConfigV2(config);

        merkleRoot = tree.setup(40 /** 1T */, bytes32(0));
        issuingStateHash = keccak256(bytes(issuingState));
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

    function getConfigId(
        bytes32 /** destinationChainId */,
        bytes32 /** userIdentifier */,
        bytes memory /** userDefinedData */
    ) public view override returns (bytes32) {
        return verificationConfigId;
    }
}
