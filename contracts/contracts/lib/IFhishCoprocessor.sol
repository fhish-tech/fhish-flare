// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhishType} from "./FhishType.sol";

interface IFhishCoprocessor {
    function fheAdd(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheSub(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheMul(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheDiv(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheRem(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheBitAnd(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheBitOr(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheBitXor(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheShl(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheShr(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheRotl(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheRotr(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheEq(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheNe(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheGe(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheGt(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheLe(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheLt(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheMin(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheMax(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheNeg(bytes32 ct) external returns (bytes32 result);
    function fheNot(bytes32 ct) external returns (bytes32 result);
    function verifyCiphertext(bytes32 inputHandle, address callerAddress, bytes memory inputProof, FhishType inputType) external returns (bytes32 result);
    function cast(bytes32 ct, FhishType toType) external returns (bytes32 result);
    function trivialEncrypt(uint256 ct, FhishType toType) external returns (bytes32 result);
    function trivialEncrypt(bytes memory ct, FhishType toType) external returns (bytes32 result);
    function fheEq(bytes32 lhs, bytes memory rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheNe(bytes32 lhs, bytes memory rhs, bytes1 scalarByte) external returns (bytes32 result);
    function fheIfThenElse(bytes32 control, bytes32 ifTrue, bytes32 ifFalse) external returns (bytes32 result);
    function fheRand(FhishType randType) external returns (bytes32 result);
    function fheRandBounded(uint256 upperBound, FhishType randType) external returns (bytes32 result);
}
