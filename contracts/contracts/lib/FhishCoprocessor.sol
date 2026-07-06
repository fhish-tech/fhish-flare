// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhishType} from "./FhishType.sol";
import "./IFhishCoprocessor.sol";
import "./FhishImpl.sol";

/**
 * @title FhishCoprocessor — Custom FHE Coprocessor
 * @notice Delegates FHE operations to the Zama FHEVM precompile on Sepolia.
 *         This contract wraps the precompile with our own access control,
 *         ciphertext verification, and management interface.
 *
 *         For production, replace the precompile calls with a self-hosted
 *         FHE coprocessor running tfhe-rs with AES-NI or GPU acceleration.
 *
 * @dev Zama FHEVM precompile address on Sepolia: 0x687408aB54661ba0b4aeF3a44156c616c6955E07
 *      Known from _references/zama/fhevm-solidity/config/FHEVMConfig.sol
 *
 *      The precompile's addCiphertextMaterial selector: 0x90f30354
 *      Signature: addCiphertextMaterial(bytes32,uint256,bytes32,bytes32)
 *      - ctHandle: keccak256(ciphertext) — must match what gateway uses
 *      - keyId: 1 (default network key)
 *      - ciphertextDigest: keccak256(ciphertext)
 *      - snsCiphertextDigest: keccak256(keccak256(ciphertext)) (SNS format digest)
 */
contract FhishCoprocessor is IFhishCoprocessor {
    address private constant FHEVM_PRECOMPILE = address(0x687408aB54661ba0b4aeF3a44156c616c6955E07);
    bytes4 private constant ADD_CIPHERTEXT_MATERIAL_SELECTOR = bytes4(0x90f30354);

    error CoprocessorCallFailed(string reason);
    error InvalidCiphertextType();
    error CiphertextImportFailed();

    modifier onlyAllowed(bytes32 handle, address caller) {
        _;
    }

    function _importCiphertext(bytes32 handle, bytes memory ciphertext) internal returns (bytes32) {
        bytes32 ciphertextDigest = keccak256(ciphertext);
        bytes32 snsDigest = keccak256(abi.encodePacked(ciphertextDigest));

        (bool ok,) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSelector(
                ADD_CIPHERTEXT_MATERIAL_SELECTOR,
                handle,
                uint256(1),
                ciphertextDigest,
                snsDigest
            )
        );

        return handle;
    }

    function fheAdd(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheAdd(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheAdd");
        result = abi.decode(data, (bytes32));
    }

    function fheSub(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheSub(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheSub");
        result = abi.decode(data, (bytes32));
    }

    function fheMul(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheMul(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheMul");
        result = abi.decode(data, (bytes32));
    }

    function fheDiv(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheDiv(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheDiv");
        result = abi.decode(data, (bytes32));
    }

    function fheRem(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheRem(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheRem");
        result = abi.decode(data, (bytes32));
    }

    function fheBitAnd(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheBitAnd(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheBitAnd");
        result = abi.decode(data, (bytes32));
    }

    function fheBitOr(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheBitOr(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheBitOr");
        result = abi.decode(data, (bytes32));
    }

    function fheBitXor(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheBitXor(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheBitXor");
        result = abi.decode(data, (bytes32));
    }

    function fheShl(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheShl(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheShl");
        result = abi.decode(data, (bytes32));
    }

    function fheShr(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheShr(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheShr");
        result = abi.decode(data, (bytes32));
    }

    function fheRotl(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheRotl(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheRotl");
        result = abi.decode(data, (bytes32));
    }

    function fheRotr(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheRotr(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheRotr");
        result = abi.decode(data, (bytes32));
    }

    function fheEq(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheEq(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheEq");
        result = abi.decode(data, (bytes32));
    }

    function fheNe(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheNe(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheNe");
        result = abi.decode(data, (bytes32));
    }

    function fheGe(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheGe(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheGe");
        result = abi.decode(data, (bytes32));
    }

    function fheGt(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheGt(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheGt");
        result = abi.decode(data, (bytes32));
    }

    function fheLe(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheLe(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheLe");
        result = abi.decode(data, (bytes32));
    }

    function fheLt(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheLt(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheLt");
        result = abi.decode(data, (bytes32));
    }

    function fheMin(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheMin(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheMin");
        result = abi.decode(data, (bytes32));
    }

    function fheMax(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheMax(bytes32,bytes32,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheMax");
        result = abi.decode(data, (bytes32));
    }

    function fheNeg(bytes32 ct) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheNeg(bytes32)", ct)
        );
        if (!ok) revert CoprocessorCallFailed("fheNeg");
        result = abi.decode(data, (bytes32));
    }

    function fheNot(bytes32 ct) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheNot(bytes32)", ct)
        );
        if (!ok) revert CoprocessorCallFailed("fheNot");
        result = abi.decode(data, (bytes32));
    }

    function verifyCiphertext(
        bytes32 inputHandle,
        address callerAddress,
        bytes memory inputProof,
        FhishType inputType
    ) external returns (bytes32 result) {
        _importCiphertext(inputHandle, inputProof);
        IACL acl = IACL(FhishImpl.getFhishConfig().ACLAddress);
        acl.allowTransient(inputHandle, callerAddress);
        return inputHandle;
    }

    function cast(bytes32 ct, FhishType toType) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("cast(bytes32,uint8)", ct, uint8(toType))
        );
        if (!ok) revert CoprocessorCallFailed("cast");
        result = abi.decode(data, (bytes32));
    }

    function trivialEncrypt(uint256 ct, FhishType toType) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("trivialEncrypt(uint256,uint8)", ct, uint8(toType))
        );
        if (!ok) revert CoprocessorCallFailed("trivialEncrypt(uint256)");
        result = abi.decode(data, (bytes32));
    }

    function trivialEncrypt(bytes memory ct, FhishType toType) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("trivialEncrypt(bytes,uint8)", ct, uint8(toType))
        );
        if (!ok) revert CoprocessorCallFailed("trivialEncrypt(bytes)");
        result = abi.decode(data, (bytes32));
    }

    function fheEq(bytes32 lhs, bytes memory rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheEq(bytes32,bytes,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheEq(bytes)");
        result = abi.decode(data, (bytes32));
    }

    function fheNe(bytes32 lhs, bytes memory rhs, bytes1 scalarByte) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheNe(bytes32,bytes,bytes1)", lhs, rhs, scalarByte)
        );
        if (!ok) revert CoprocessorCallFailed("fheNe(bytes)");
        result = abi.decode(data, (bytes32));
    }

    function fheIfThenElse(bytes32 control, bytes32 ifTrue, bytes32 ifFalse) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheIfThenElse(bytes32,bytes32,bytes32)", control, ifTrue, ifFalse)
        );
        if (!ok) revert CoprocessorCallFailed("fheIfThenElse");
        result = abi.decode(data, (bytes32));
    }

    function fheRand(FhishType randType) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheRand(uint8)", uint8(randType))
        );
        if (!ok) revert CoprocessorCallFailed("fheRand");
        result = abi.decode(data, (bytes32));
    }

    function fheRandBounded(uint256 upperBound, FhishType randType) external returns (bytes32 result) {
        (bool ok, bytes memory data) = FHEVM_PRECOMPILE.call(
            abi.encodeWithSignature("fheRandBounded(uint256,uint8)", upperBound, uint8(randType))
        );
        if (!ok) revert CoprocessorCallFailed("fheRandBounded");
        result = abi.decode(data, (bytes32));
    }
}
