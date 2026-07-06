// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title ThresholdKMSVerifier — M-of-N decryption committee (like Zama's threshold KMS)
 * @notice Removes the single-gateway trust point on-chain: a decryption result is only accepted if at
 *         least `threshold` DISTINCT authorized KMS operators signed it. No one operator can forge a
 *         fulfillment. This is the on-chain half of a threshold KMS.
 *
 *  Honest scope: this decentralizes *decryption authorization* (who may post a decrypted result on-chain).
 *  It does NOT yet split the FHE secret key across parties via MPC (true threshold-FHE decryption, where
 *  no operator ever sees the key) — that is the deeper roadmap Zama is still hardening. Here each operator
 *  can decrypt, but ≥`threshold` must agree for the chain to accept it.
 */
contract ThresholdKMSVerifier {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    mapping(address => bool) public isSigner;
    address[] public signers;
    uint256 public threshold;
    address public controller;

    event CommitteeUpdated(address[] signers, uint256 threshold);
    event ControllerUpdated(address indexed oldController, address indexed newController);

    error InvalidThreshold();

    modifier onlyController() { require(msg.sender == controller, "not controller"); _; }

    constructor(address[] memory _signers, uint256 _threshold) {
        controller = msg.sender;
        _setCommittee(_signers, _threshold);
    }

    function _setCommittee(address[] memory _signers, uint256 _threshold) internal {
        if (_threshold == 0 || _threshold > _signers.length) revert InvalidThreshold();
        // clear old
        for (uint256 i = 0; i < signers.length; i++) isSigner[signers[i]] = false;
        delete signers;
        for (uint256 i = 0; i < _signers.length; i++) {
            require(_signers[i] != address(0) && !isSigner[_signers[i]], "bad signer");
            isSigner[_signers[i]] = true;
            signers.push(_signers[i]);
        }
        threshold = _threshold;
        emit CommitteeUpdated(_signers, _threshold);
    }

    function setCommittee(address[] calldata _signers, uint256 _threshold) external onlyController {
        _setCommittee(_signers, _threshold);
    }

    function setController(address c) external onlyController {
        require(c != address(0), "zero");
        emit ControllerUpdated(controller, c);
        controller = c;
    }

    function signerCount() external view returns (uint256) { return signers.length; }

    /// @notice True iff ≥ threshold DISTINCT authorized operators signed (handles, decryptedResult).
    function verifyDecryptionSignatures(
        bytes32[] memory handlesList,
        bytes memory decryptedResult,
        bytes[] memory signatures
    ) public view returns (bool) {
        if (signatures.length < threshold) return false;
        bytes32 messageHash = keccak256(abi.encodePacked(handlesList, decryptedResult)).toEthSignedMessageHash();

        address[] memory seen = new address[](signatures.length);
        uint256 count = 0;
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = messageHash.recover(signatures[i]);
            if (!isSigner[signer]) continue;
            bool dup = false;
            for (uint256 j = 0; j < count; j++) if (seen[j] == signer) { dup = true; break; }
            if (dup) continue;
            seen[count++] = signer;
            if (count >= threshold) return true;
        }
        return count >= threshold;
    }

    /// @dev Back-compat single-signature check (any one committee member).
    function verifySingleSignature(bytes32 messageHash, bytes calldata signature) external view returns (bool) {
        return isSigner[messageHash.recover(signature)];
    }

    /// @dev Back-compat: exposes the first signer as "gatewaySigner" for legacy callers.
    function gatewaySigner() external view returns (address) { return signers.length > 0 ? signers[0] : address(0); }
}
