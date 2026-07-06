// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "./lib/FhishTFHE.sol";

contract SetupHelper {
    function initFhish(
        address acl,
        address executor,
        address kms,
        address inputVerifier
    ) external {
        FhishConfigStruct memory config = FhishConfigStruct({
            ACLAddress: acl,
            FhishExecutorAddress: executor,
            KMSVerifierAddress: kms,
            InputVerifierAddress: inputVerifier
        });
        FhishTFHE.setCoprocessor(config);
    }
}
