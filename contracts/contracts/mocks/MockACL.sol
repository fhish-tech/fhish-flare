// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

contract MockACL {
    mapping(bytes32 => mapping(address => bool)) private allowed;
    mapping(bytes32 => mapping(address => bool)) private transientAllowed;

    function allow(bytes32 handle, address account) external {
        allowed[handle][account] = true;
    }

    function allowTransient(bytes32 handle, address account) external {
        transientAllowed[handle][account] = true;
    }

    function isAllowed(bytes32 handle, address account) external view returns (bool) {
        return allowed[handle][account] || transientAllowed[handle][account];
    }

    function cleanTransientStorage() external {
        // Mock: Does nothing
    }

    function allowForDecryption(bytes32[] memory /*handlesList*/) external {
        // Mock: Does nothing
    }

    function isAllowedForDecryption(bytes32 /*handle*/) external pure returns (bool) {
        return true;
    }
}
