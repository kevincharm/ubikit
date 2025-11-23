// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IIdentityVerificationHubV2} from "@selfxyz/contracts/contracts/interfaces/IIdentityVerificationHubV2.sol";
import {IDscCircuitVerifier} from "@selfxyz/contracts/contracts/interfaces/IDscCircuitVerifier.sol";
import {IRegisterCircuitVerifier} from "@selfxyz/contracts/contracts/interfaces/IRegisterCircuitVerifier.sol";
import {ISelfVerificationRoot} from "@selfxyz/contracts/contracts/interfaces/ISelfVerificationRoot.sol";
import {SelfStructs} from "@selfxyz/contracts/contracts/libraries/SelfStructs.sol";

/// @notice Lightweight mock for driving PassportBoundNFT tests
contract MockIdentityVerificationHubV2 is IIdentityVerificationHubV2 {
    bytes32 public lastConfigId;
    SelfStructs.VerificationConfigV2 public lastConfig;
    bytes public lastBaseVerificationInput;
    bytes public lastUserContextData;

    function setVerificationConfigV2(
        SelfStructs.VerificationConfigV2 memory config
    ) external returns (bytes32 configId) {
        lastConfig = config;
        configId = sha256(abi.encode(config));
        lastConfigId = configId;
    }

    function verify(bytes calldata baseVerificationInput, bytes calldata userContextData) external {
        lastBaseVerificationInput = baseVerificationInput;
        lastUserContextData = userContextData;
    }

    function triggerSuccess(
        address target,
        ISelfVerificationRoot.GenericDiscloseOutputV2 memory output,
        bytes memory userData
    ) external {
        ISelfVerificationRoot(target).onVerificationSuccess(abi.encode(output), userData);
    }

    function registerCommitment(
        bytes32,
        uint256,
        IRegisterCircuitVerifier.RegisterCircuitProof calldata
    ) external {}

    function registerDscKeyCommitment(
        bytes32,
        uint256,
        IDscCircuitVerifier.DscCircuitProof calldata
    ) external {}

    function updateRegistry(bytes32, address) external {}

    function updateVcAndDiscloseCircuit(bytes32, address) external {}

    function updateRegisterCircuitVerifier(bytes32, uint256, address) external {}

    function updateDscVerifier(bytes32, uint256, address) external {}

    function batchUpdateRegisterCircuitVerifiers(
        bytes32[] calldata,
        uint256[] calldata,
        address[] calldata
    ) external {}

    function batchUpdateDscCircuitVerifiers(
        bytes32[] calldata,
        uint256[] calldata,
        address[] calldata
    ) external {}

    function registry(bytes32) external pure returns (address) {
        return address(0);
    }

    function discloseVerifier(bytes32) external pure returns (address) {
        return address(0);
    }

    function registerCircuitVerifiers(bytes32, uint256) external pure returns (address) {
        return address(0);
    }

    function dscCircuitVerifiers(bytes32, uint256) external pure returns (address) {
        return address(0);
    }

    function rootTimestamp(bytes32, uint256) external pure returns (uint256) {
        return 0;
    }

    function getIdentityCommitmentMerkleRoot(bytes32) external pure returns (uint256) {
        return 0;
    }

    function verificationConfigV2Exists(bytes32 configId) external view returns (bool) {
        return configId == lastConfigId;
    }

    function generateConfigId(SelfStructs.VerificationConfigV2 memory config) external pure returns (bytes32) {
        return sha256(abi.encode(config));
    }
}
