// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhishType} from "../lib/FhishType.sol";

contract MockFhishExecutor {
    function fheAdd(bytes32 lhs, bytes32 rhs, bytes1 /*scalarByte*/) external pure returns (bytes32) {
        return bytes32(uint256(lhs) + uint256(rhs));
    }
    function fheSub(bytes32 lhs, bytes32 rhs, bytes1 /*scalarByte*/) external pure returns (bytes32) {
        return bytes32(uint256(lhs) - uint256(rhs));
    }
    function fheMul(bytes32 lhs, bytes32 rhs, bytes1 /*scalarByte*/) external pure returns (bytes32) {
        return bytes32(uint256(lhs) * uint256(rhs));
    }
    function fheDiv(bytes32 lhs, bytes32 rhs, bytes1 /*scalarByte*/) external pure returns (bytes32) {
        return bytes32(uint256(lhs) / uint256(rhs));
    }
    function fheEq(bytes32 lhs, bytes32 rhs, bytes1 /*scalarByte*/) external pure returns (bytes32) {
        return bytes32(uint256(lhs == rhs ? 1 : 0));
    }
    function fheNe(bytes32 lhs, bytes32 rhs, bytes1 /*scalarByte*/) external pure returns (bytes32) {
        return bytes32(uint256(lhs != rhs ? 1 : 0));
    }
    function fheGe(bytes32 lhs, bytes32 rhs, bytes1 /*scalarByte*/) external pure returns (bytes32) {
        return bytes32(uint256(lhs >= rhs ? 1 : 0));
    }
    function fheGt(bytes32 lhs, bytes32 rhs, bytes1 /*scalarByte*/) external pure returns (bytes32) {
        return bytes32(uint256(lhs > rhs ? 1 : 0));
    }
    function fheLe(bytes32 lhs, bytes32 rhs, bytes1 /*scalarByte*/) external pure returns (bytes32) {
        return bytes32(uint256(lhs <= rhs ? 1 : 0));
    }
    function fheLt(bytes32 lhs, bytes32 rhs, bytes1 /*scalarByte*/) external pure returns (bytes32) {
        return bytes32(uint256(lhs < rhs ? 1 : 0));
    }
    function fheIfThenElse(bytes32 control, bytes32 ifTrue, bytes32 ifFalse) external pure returns (bytes32) {
        return uint256(control) != 0 ? ifTrue : ifFalse;
    }
    function trivialEncrypt(uint256 value, FhishType /*toType*/) external pure returns (bytes32) {
        return bytes32(value);
    }
    function verifyCiphertext(bytes32 inputHandle, address /*callerAddress*/, bytes memory /*inputProof*/, FhishType /*inputType*/) external pure returns (bytes32) {
        return inputHandle;
    }
}
