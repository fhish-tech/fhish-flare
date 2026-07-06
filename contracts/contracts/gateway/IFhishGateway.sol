// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/**
 * @title IFhishGateway
 * @notice Interface for the Fhish Gateway contract.
 */
interface IFhishGateway {
    struct ContractsInfo {
        uint256 chainId;
        address[] addresses;
    }

    struct RequestValidity {
        uint256 startTimestamp;
        uint256 durationDays;
    }

    struct DelegationAccounts {
        address delegatorAddress;
        address delegateAddress;
    }

    event PublicDecryptionRequest(
        uint256 indexed decryptionId,
        bytes32[] ctHandles,
        bytes extraData
    );

    event PublicDecryptionResponse(
        uint256 indexed decryptionId,
        bytes decryptedResult,
        bytes[] signatures,
        bytes extraData
    );

    function publicDecryptionRequest(bytes32[] calldata ctHandles, bytes calldata extraData) external;

    function submitCiphertext(bytes calldata ciphertext) external returns (bytes32 handle);

    function getCiphertext(bytes32 handle) external view returns (bytes memory ciphertext);

    function requestDecryption(
        uint256[] calldata ctsHandles,
        bytes4 callbackSelector,
        uint256 msgValue,
        uint256 maxTimestamp,
        bool passSignaturesToCaller
    ) external returns (uint256);

    function isDecryptionDone(uint256 decryptionId) external view returns (bool);
}
