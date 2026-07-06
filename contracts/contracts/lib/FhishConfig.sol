// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

struct FhishConfigStruct {
    address ACLAddress;
    address FhishExecutorAddress;
    address KMSVerifierAddress;
    address InputVerifierAddress;
}

library FhishConfig {
    bytes32 private constant CONFIG_SLOT = 0xed8d60e34876f751cc8b014c560745351147d9de11b9347c854e881b128ea600;

    function getSepoliaConfig() internal pure returns (FhishConfigStruct memory) {
        return FhishConfigStruct({
            ACLAddress: 0x395162aD6752ed2B0E20CB5B302a302e9a117208,
            FhishExecutorAddress: 0x687408aB54661ba0b4aeF3a44156c616c6955E07,
            KMSVerifierAddress: 0xF88371B05B0f78CcAd8327855D1B2690A517E287,
            InputVerifierAddress: 0x0000000000000000000000000000000000000000
        });
    }

    function getHardhatConfig() internal pure returns (FhishConfigStruct memory) {
        return FhishConfigStruct({
            ACLAddress: 0x0000000000000000000000000000000000000001,
            FhishExecutorAddress: 0x0000000000000000000000000000000000000002,
            KMSVerifierAddress: 0x0000000000000000000000000000000000000003,
            InputVerifierAddress: 0x0000000000000000000000000000000000000004
        });
    }
}
