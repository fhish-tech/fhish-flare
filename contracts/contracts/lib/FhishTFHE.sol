// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "./FhishImpl.sol";
import {FhishType} from "./FhishType.sol";

type ebool is bytes32;
type euint8 is bytes32;
type euint16 is bytes32;
type euint32 is bytes32;
type euint64 is bytes32;
type euint128 is bytes32;
type euint256 is bytes32;
type eaddress is bytes32;
type ebytes64 is bytes32;
type ebytes128 is bytes32;
type ebytes256 is bytes32;

/**
 * @title IFhishKMSVerifier
 * @notice Rebranded KMS Verifier interface.
 */
interface IFhishKMSVerifier {
    function verifyDecryptionSignatures(
        bytes32[] memory handlesList,
        bytes memory decryptedResult,
        bytes[] memory signatures
    ) external returns (bool);
}

/**
 * @title IFhishDecryptionOracle
 * @notice Rebranded Decryption Oracle interface.
 */
interface IFhishDecryptionOracle {
    function requestDecryption(uint256 requestID, bytes32[] calldata ctsHandles, bytes4 callbackSelector) external;
}

/**
 * @title   FhishTFHE
 * @notice  This library is the interaction point for all smart contract developers
 *          interacting with the FHISH V2 protocol.
 */
library FhishTFHE {
    error InputLengthAbove64Bytes(uint256 inputLength);
    error NoHandleFoundForRequestID();
    error InvalidKMSSignatures();

    event DecryptionFulfilled(uint256 indexed requestID);

    function setCoprocessor(FhishConfigStruct memory config) internal {
        FhishImpl.setCoprocessor(config);
    }

    function setDecryptionOracle(address decryptionOracle) internal {
        FhishImpl.setDecryptionOracle(decryptionOracle);
    }

    function isInitialized(ebool v) internal pure returns (bool) {
        return ebool.unwrap(v) != 0;
    }

    function asEuint32(bytes32 handle, bytes memory proof) internal returns (euint32) {
        return euint32.wrap(FhishImpl.verify(handle, proof, FhishType.euint32));
    }

    function asEuint32(bytes memory proof) internal returns (euint32) {
        return asEuint32(bytes32(0), proof);
    }

    function asEuint32(uint32 value) internal returns (euint32) {
        return euint32.wrap(FhishImpl.trivialEncrypt(uint256(value), FhishType.euint32));
    }

    function add(euint32 a, euint32 b) internal returns (euint32) {
        return euint32.wrap(FhishImpl.add(euint32.unwrap(a), euint32.unwrap(b), false));
    }

    function sub(euint32 a, euint32 b) internal returns (euint32) {
        return euint32.wrap(FhishImpl.sub(euint32.unwrap(a), euint32.unwrap(b), false));
    }

    function mul(euint32 a, euint32 b) internal returns (euint32) {
        return euint32.wrap(FhishImpl.mul(euint32.unwrap(a), euint32.unwrap(b), false));
    }

    function eq(euint32 a, euint32 b) internal returns (ebool) {
        return ebool.wrap(FhishImpl.eq(euint32.unwrap(a), euint32.unwrap(b), false));
    }

    function ne(euint32 a, euint32 b) internal returns (ebool) {
        return ebool.wrap(FhishImpl.ne(euint32.unwrap(a), euint32.unwrap(b), false));
    }

    function ge(euint32 a, euint32 b) internal returns (ebool) {
        return ebool.wrap(FhishImpl.ge(euint32.unwrap(a), euint32.unwrap(b), false));
    }

    function gt(euint32 a, euint32 b) internal returns (ebool) {
        return ebool.wrap(FhishImpl.gt(euint32.unwrap(a), euint32.unwrap(b), false));
    }

    function le(euint32 a, euint32 b) internal returns (ebool) {
        return ebool.wrap(FhishImpl.le(euint32.unwrap(a), euint32.unwrap(b), false));
    }

    function lt(euint32 a, euint32 b) internal returns (ebool) {
        return ebool.wrap(FhishImpl.lt(euint32.unwrap(a), euint32.unwrap(b), false));
    }

    function select(ebool control, euint32 ifTrue, euint32 ifFalse) internal returns (euint32) {
        return euint32.wrap(FhishImpl.select(ebool.unwrap(control), euint32.unwrap(ifTrue), euint32.unwrap(ifFalse)));
    }

    function allow(bytes32 handle, address account) internal {
        FhishImpl.allow(handle, account);
    }

    function allowTransient(bytes32 handle, address account) internal {
        FhishImpl.allowTransient(handle, account);
    }

    function isAllowed(bytes32 handle, address account) internal view returns (bool) {
        return FhishImpl.isAllowed(handle, account);
    }

    function decrypt(euint32 a) internal returns (uint32) {
        return uint32(FhishImpl.decrypt(euint32.unwrap(a)));
    }

    function toUint256(euint32 v) internal pure returns (uint256) {
        return uint256(euint32.unwrap(v));
    }
}
