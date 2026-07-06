// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title FhishKMSVerifier — Gateway KMS Signature Verification
 * @notice Verifies ECDSA signatures from the gateway KMS service.
 *         Signatures are over structured EIP-712 data confirming the
 *         decryption results are authentic (produced by the gateway).
 */
contract FhishKMSVerifier {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    address public gatewaySigner;

    /// @notice The only address allowed to update `gatewaySigner`.
    /// @dev On Flare this is set to the AttestationRegistry, so the signer can ONLY be
    ///      an enclave key bound by a verified Confidential Space attestation. Defaults to
    ///      the deployer at construction so it can be handed to the registry once wired.
    address public controller;

    event GatewaySignerUpdated(address indexed oldSigner, address indexed newSigner);
    event ControllerUpdated(address indexed oldController, address indexed newController);

    modifier onlyController() {
        require(msg.sender == controller, "Not controller");
        _;
    }

    constructor(address initialSigner) {
        gatewaySigner = initialSigner;
        controller = msg.sender;
    }

    /// @notice Hand control of the signer to the AttestationRegistry (or rotate it).
    function setController(address newController) external onlyController {
        require(newController != address(0), "Invalid controller");
        emit ControllerUpdated(controller, newController);
        controller = newController;
    }

    /// @notice Update the gateway signer. Gated: only the controller (the AttestationRegistry)
    ///         may call this, so the signer is always an attestation-bound enclave key.
    ///         `address(0)` is permitted to disable signing on enclave revocation.
    function setGatewaySigner(address newSigner) external onlyController {
        address oldSigner = gatewaySigner;
        gatewaySigner = newSigner;
        emit GatewaySignerUpdated(oldSigner, newSigner);
    }

    function verifyDecryptionSignatures(
        bytes32[] memory handlesList,
        bytes memory decryptedResult,
        bytes[] memory signatures
    ) external view returns (bool) {
        if (signatures.length == 0) return false;
        if (signatures.length != handlesList.length && signatures.length != 1) return false;

        bytes32 messageHash = keccak256(abi.encodePacked(handlesList, decryptedResult))
            .toEthSignedMessageHash();

        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = messageHash.recover(signatures[i]);
            if (signer != gatewaySigner) return false;
        }

        return true;
    }

    function verifySingleSignature(
        bytes32 messageHash,
        bytes calldata signature
    ) external view returns (bool) {
        return messageHash.recover(signature) == gatewaySigner;
    }
}
