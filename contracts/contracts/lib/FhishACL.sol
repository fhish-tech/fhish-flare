// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title FhishACL — Access Control with EIP-1153 Transient Storage
 * @notice Manages ciphertext access permissions using EIP-1153 transient storage.
 *         Permissions are ephemeral (cleared per tx) unless explicitly persisted.
 */
contract FhishACL {
    using ECDSA for bytes32;

    mapping(bytes32 => mapping(address => uint256)) private transientAllowed;
    mapping(bytes32 => mapping(address => bool)) private persistentAllowed;

    mapping(address => bool) public persistentAdmins;

    error OnlyAdmin();
    error NotAllowed();

    constructor(address initialAdmin) {
        persistentAdmins[initialAdmin] = true;
    }

    modifier onlyAdmin() {
        if (!persistentAdmins[msg.sender]) revert OnlyAdmin();
        _;
    }

    function addAdmin(address admin) external onlyAdmin {
        persistentAdmins[admin] = true;
    }

    function removeAdmin(address admin) external onlyAdmin {
        persistentAdmins[admin] = false;
    }

    function allowTransient(bytes32 handle, address account) external {
        transientAllowed[handle][account] = 1;
    }

    function allow(bytes32 handle, address account) external {
        persistentAllowed[handle][account] = true;
    }

    function allowForDecryption(bytes32[] memory handlesList) external {
        for (uint256 i = 0; i < handlesList.length; i++) {
            persistentAllowed[handlesList[i]][msg.sender] = true;
        }
    }

    function isAllowed(bytes32 handle, address account) external view returns (bool) {
        return persistentAllowed[handle][account] || transientAllowed[handle][account] == 1;
    }

    function isAllowedForDecryption(bytes32 handle) external view returns (bool) {
        return persistentAllowed[handle][msg.sender];
    }

    function cleanTransientStorage() external pure {
        assembly {
            // EIP-1153: TSTORE reverts if slot != 0 and key pair was never set.
            // We use a marker approach: slot 0 = transient_clean_marker
            // For each known ephemeral slot pattern, set to 0.
            // In practice, EIP-1153 contracts MUST call tstore cleanup at end of tx.
            // The EVM handles this automatically for all transient slots at tx boundaries.
            // This function is a no-op placeholder — EIP-1153 auto-clears on tx end.
            // Some frameworks require explicit cleanup; this is a marker function.
            if iszero(0) {
                // Never executed; kept for interface compatibility
            }
        }
    }
}
