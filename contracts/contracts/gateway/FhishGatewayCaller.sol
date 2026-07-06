// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "./IFhishGateway.sol";

/**
 * @title FhishGatewayCaller
 * @notice Abstract contract to be inherited by contracts that want to request decryptions from the Fhish Gateway.
 */
abstract contract FhishGatewayCaller {
    IFhishGateway internal Gateway;

    error OnlyGatewayAllowed();

    constructor(address gateway) {
        Gateway = IFhishGateway(gateway);
    }

    modifier onlyGateway() {
        if (msg.sender != address(Gateway)) {
            revert OnlyGatewayAllowed();
        }
        _;
    }

    /**
     * @notice Internal function to request a public decryption.
     * @param ctHandles The handles of the ciphertexts to decrypt.
     * @param extraData Generic bytes metadata for versioned payloads.
     */
    function _publicDecryptionRequest(bytes32[] memory ctHandles, bytes memory extraData) internal {
        Gateway.publicDecryptionRequest(ctHandles, extraData);
    }

    function _requestDecryption(
        uint256[] memory ctHandles,
        bytes4 selector,
        uint256 msgValue,
        uint256 maxTimestamp,
        bool passSignaturesToCaller
    ) internal returns (uint256) {
        return Gateway.requestDecryption(ctHandles, selector, msgValue, maxTimestamp, passSignaturesToCaller);
    }
}
