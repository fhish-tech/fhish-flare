// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "../gateway/IFhishGateway.sol";

/**
 * @title DecryptionConsumer — proves the full automated fhish decryption loop on Flare
 * @notice reveal(handle) -> Gateway.requestDecryption -> (off-chain: relayer materializes the
 *         ciphertext, the TEE enclave signs the plaintext) -> Gateway.fulfillPublicDecryption
 *         verifies the signature against the attestation-bound FhishKMSVerifier, then calls
 *         onDecrypted() here. The revealed value only lands on-chain if an ATTESTED enclave signed it.
 */
contract DecryptionConsumer {
    IFhishGateway public immutable gateway;
    address public immutable admin;

    uint256 public lastDecryptionId;
    uint32 public revealedValue;
    bool public revealed;

    event RevealRequested(uint256 indexed decryptionId, bytes32 handle);
    event Revealed(uint256 indexed decryptionId, uint32 value);

    error OnlyGateway();

    constructor(address _gateway) {
        gateway = IFhishGateway(_gateway);
        admin = msg.sender;
    }

    /// @notice Ask the gateway to decrypt `handle`; the callback `onDecrypted` fires when fulfilled.
    function reveal(bytes32 handle) external returns (uint256 id) {
        uint256[] memory handles = new uint256[](1);
        handles[0] = uint256(handle);
        id = gateway.requestDecryption(handles, this.onDecrypted.selector, 0, 0, false);
        lastDecryptionId = id;
        revealed = false;
        emit RevealRequested(id, handle);
    }

    /// @notice Gateway callback. data = abi.encode(decryptionId, decryptedResult).
    ///         Only reached AFTER the gateway verified the enclave (attestation-bound) signature.
    function onDecrypted(bytes calldata data) external {
        if (msg.sender != address(gateway)) revert OnlyGateway();
        (uint256 id, bytes memory result) = abi.decode(data, (uint256, bytes));
        uint32 value = abi.decode(result, (uint32));
        revealedValue = value;
        revealed = true;
        emit Revealed(id, value);
    }
}
