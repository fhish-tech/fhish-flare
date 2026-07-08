// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhishType} from "./FhishType.sol";
import "./IFhishCoprocessor.sol";

/**
 * @title FhishCoprocessor — symbolic FHE executor for Flare
 * @notice The on-chain half of the fhish/fhEVM coprocessor model. It performs NO FHE math on-chain
 *         (an EVM can't). Instead each op derives a deterministic, typed 32-byte *handle* and emits an
 *         `FheOp` / `TrivialEncrypt` / `VerifyInput` event. An off-chain coprocessor watches those
 *         events and materializes the REAL Zama tfhe ciphertext for each result handle; the gateway
 *         decrypts under ACL. This is exactly how Zama fhEVM and Fhenix work — the chain tracks the
 *         computation graph over handles, the ciphertexts live off-chain.
 *
 *         Result handle layout: keccak256(op‖operands)[0..30] ‖ typeByte(31). The type byte lets the
 *         off-chain coprocessor know how to interpret/decrypt each handle. Deterministic ⇒ the same
 *         computation always yields the same handle, so the graph is reproducible and verifiable.
 */
contract FhishCoprocessor is IFhishCoprocessor {
    // opcodes
    uint8 constant ADD=1; uint8 constant SUB=2; uint8 constant MUL=3; uint8 constant DIV=4; uint8 constant REM=5;
    uint8 constant AND=6; uint8 constant OR=7; uint8 constant XOR=8; uint8 constant SHL=9; uint8 constant SHR=10;
    uint8 constant ROTL=11; uint8 constant ROTR=12; uint8 constant EQ=13; uint8 constant NE=14; uint8 constant GE=15;
    uint8 constant GT=16; uint8 constant LE=17; uint8 constant LT=18; uint8 constant MIN=19; uint8 constant MAX=20;
    uint8 constant NEG=21; uint8 constant NOT=22; uint8 constant SELECT=23; uint8 constant CAST=24; uint8 constant RAND=27;

    /// @notice A homomorphic op the off-chain coprocessor must materialize.
    event FheOp(uint8 indexed op, bytes32 result, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, uint8 resultType);
    /// @notice Select needs THREE operands (control, ifTrue, ifFalse) — a plain FheOp can't carry the control.
    event FheSelect(bytes32 result, bytes32 control, bytes32 ifTrue, bytes32 ifFalse, uint8 resultType);
    event TrivialEncrypt(bytes32 result, uint256 value, uint8 toType);
    event VerifyInput(bytes32 result, bytes32 inputHandle, address caller, uint8 inputType);
    event Cast(bytes32 result, bytes32 ct, uint8 toType);
    /// @notice Verifiable randomness: value derived from `seed` (bind to an on-chain RNG), encrypted off-chain.
    event Rand(bytes32 result, uint256 upperBound, bytes32 seed, uint8 randType);

    // ---- handle helpers ----
    function _typeOf(bytes32 h) internal pure returns (uint8) { return uint8(uint256(h)); }
    function _make(bytes memory pre, uint8 ftype) internal pure returns (bytes32) {
        bytes32 h = keccak256(pre);
        return bytes32((uint256(h) & ~uint256(0xff)) | uint256(ftype));
    }

    function _bin(uint8 op, bytes32 lhs, bytes32 rhs, bytes1 s, uint8 rtype) internal returns (bytes32 r) {
        r = _make(abi.encodePacked(op, lhs, rhs, s), rtype);
        emit FheOp(op, r, lhs, rhs, s, rtype);
    }
    // arithmetic/bitwise: result type = type of lhs
    function _arith(uint8 op, bytes32 lhs, bytes32 rhs, bytes1 s) internal returns (bytes32) {
        return _bin(op, lhs, rhs, s, _typeOf(lhs));
    }
    // comparisons: result type = ebool (0)
    function _cmp(uint8 op, bytes32 lhs, bytes32 rhs, bytes1 s) internal returns (bytes32) {
        return _bin(op, lhs, rhs, s, uint8(FhishType.ebool));
    }

    function fheAdd(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _arith(ADD, l, r, s); }
    function fheSub(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _arith(SUB, l, r, s); }
    function fheMul(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _arith(MUL, l, r, s); }
    function fheDiv(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _arith(DIV, l, r, s); }
    function fheRem(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _arith(REM, l, r, s); }
    function fheBitAnd(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _arith(AND, l, r, s); }
    function fheBitOr(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _arith(OR, l, r, s); }
    function fheBitXor(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _arith(XOR, l, r, s); }
    function fheShl(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _arith(SHL, l, r, s); }
    function fheShr(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _arith(SHR, l, r, s); }
    function fheRotl(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _arith(ROTL, l, r, s); }
    function fheRotr(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _arith(ROTR, l, r, s); }
    function fheMin(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _arith(MIN, l, r, s); }
    function fheMax(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _arith(MAX, l, r, s); }
    function fheEq(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _cmp(EQ, l, r, s); }
    function fheNe(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _cmp(NE, l, r, s); }
    function fheGe(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _cmp(GE, l, r, s); }
    function fheGt(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _cmp(GT, l, r, s); }
    function fheLe(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _cmp(LE, l, r, s); }
    function fheLt(bytes32 l, bytes32 r, bytes1 s) external returns (bytes32) { return _cmp(LT, l, r, s); }

    function fheNeg(bytes32 ct) external returns (bytes32 r) { r = _make(abi.encodePacked(NEG, ct), _typeOf(ct)); emit FheOp(NEG, r, ct, bytes32(0), 0, _typeOf(ct)); }
    function fheNot(bytes32 ct) external returns (bytes32 r) { r = _make(abi.encodePacked(NOT, ct), _typeOf(ct)); emit FheOp(NOT, r, ct, bytes32(0), 0, _typeOf(ct)); }

    function fheIfThenElse(bytes32 c, bytes32 a, bytes32 b) external returns (bytes32 r) {
        uint8 t = _typeOf(a);
        r = _make(abi.encodePacked(SELECT, c, a, b), t);
        emit FheSelect(r, c, a, b, t); // carries the control handle so the coprocessor can materialize it
    }

    function verifyCiphertext(bytes32 inputHandle, address caller, bytes memory /*proof*/, FhishType inputType)
        external returns (bytes32 r)
    {
        // Input proof is a pass-through (matches fhish v2). The returned handle is bound to the
        // client-uploaded ciphertext handle so the on-chain handle matches the off-chain ciphertext.
        r = _make(abi.encodePacked("VERIFY", inputHandle, uint8(inputType)), uint8(inputType));
        emit VerifyInput(r, inputHandle, caller, uint8(inputType));
    }

    function trivialEncrypt(uint256 value, FhishType toType) external returns (bytes32 r) {
        r = _make(abi.encodePacked("TRIVIAL", value, uint8(toType)), uint8(toType));
        emit TrivialEncrypt(r, value, uint8(toType));
    }
    function trivialEncrypt(bytes memory value, FhishType toType) external returns (bytes32 r) {
        r = _make(abi.encodePacked("TRIVIALB", value, uint8(toType)), uint8(toType));
        emit TrivialEncrypt(r, 0, uint8(toType));
    }

    function cast(bytes32 ct, FhishType toType) external returns (bytes32 r) {
        r = _make(abi.encodePacked(CAST, ct, uint8(toType)), uint8(toType));
        emit Cast(r, ct, uint8(toType));
    }

    function fheEq(bytes32 l, bytes memory r_, bytes1 s) external returns (bytes32 r) { r = _make(abi.encodePacked(EQ, l, r_, s), uint8(FhishType.ebool)); emit FheOp(EQ, r, l, keccak256(r_), s, uint8(FhishType.ebool)); }
    function fheNe(bytes32 l, bytes memory r_, bytes1 s) external returns (bytes32 r) { r = _make(abi.encodePacked(NE, l, r_, s), uint8(FhishType.ebool)); emit FheOp(NE, r, l, keccak256(r_), s, uint8(FhishType.ebool)); }

    function fheRand(FhishType randType) external returns (bytes32 r) {
        bytes32 seed = blockhash(block.number - 1);
        r = _make(abi.encodePacked(RAND, seed, randType), uint8(randType));
        emit Rand(r, 0, seed, uint8(randType));
    }
    function fheRandBounded(uint256 upperBound, FhishType randType) external returns (bytes32 r) {
        bytes32 seed = blockhash(block.number - 1);
        r = _make(abi.encodePacked(RAND, upperBound, seed, randType), uint8(randType));
        emit Rand(r, upperBound, seed, uint8(randType));
    }
    /// @notice Randomness bound to an EXPLICIT seed — pass Flare's secure RNG (RandomNumberV2) for
    ///         verifiable, decentralized randomness that no single party can bias.
    function fheRandBoundedSeeded(uint256 upperBound, bytes32 seed, FhishType randType) external returns (bytes32 r) {
        r = _make(abi.encodePacked(RAND, upperBound, seed, randType), uint8(randType));
        emit Rand(r, upperBound, seed, uint8(randType));
    }
}
