// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhishType} from "./FhishType.sol";

contract FhishInputVerifier {
    bool public verificationEnabled = false;
    address public verifierContract;
    
    event ZKProofVerified(bytes32 indexed inputHandle, address indexed caller, FhishType inputType);
    event ZKProofRejected(bytes32 indexed inputHandle, address indexed caller, string reason);

    modifier requiresVerification() {
        if (verificationEnabled) {
            revert("ZK verification required but not implemented");
        }
        _;
    }

    function setVerificationEnabled(bool enabled) external {
        verificationEnabled = enabled;
    }

    function setVerifierContract(address _verifierContract) external {
        verifierContract = _verifierContract;
    }

    function verifyCiphertext(
        bytes32 inputHandle,
        address callerAddress,
        bytes memory inputProof,
        FhishType inputType
    ) external requiresVerification returns (bytes32 result) {
        if (verifierContract != address(0)) {
            (bool success, bytes memory data) = verifierContract.staticcall(
                abi.encodeWithSignature(
                    "verifyProof(bytes32,address,bytes,FhishType.FhishTypeEnum)",
                    inputHandle,
                    callerAddress,
                    inputProof,
                    uint8(inputType)
                )
            );
            if (success && abi.decode(data, (bool))) {
                emit ZKProofVerified(inputHandle, callerAddress, inputType);
                return inputHandle;
            }
            emit ZKProofRejected(inputHandle, callerAddress, "Proof verification failed");
            revert("Invalid ZK proof");
        }
        
        emit ZKProofVerified(inputHandle, callerAddress, inputType);
        return inputHandle;
    }

    function cleanTransientStorage() external pure {
    }
}
