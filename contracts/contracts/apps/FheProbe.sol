// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "../lib/FhishTFHE.sol";

/// @notice Probe to empirically test whether the on-chain FHE library (FhishTFHE) actually
///         executes on Coston2. It calls trivialEncrypt+add, which route to the configured
///         FhishExecutor (coprocessor). If no executor is deployed/wired, these calls revert —
///         proving on-chain FHE needs an executor Flare does not have.
contract FheProbe {
    function setup(address acl, address exec, address kms, address iv) external {
        FhishTFHE.setCoprocessor(FhishConfigStruct(acl, exec, kms, iv));
    }

    function tryOnchainFHE() external returns (uint256) {
        euint32 a = FhishTFHE.asEuint32(uint32(3));
        euint32 b = FhishTFHE.asEuint32(uint32(5));
        euint32 c = FhishTFHE.add(a, b);
        return FhishTFHE.toUint256(c);
    }
}
