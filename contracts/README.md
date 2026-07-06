# Fhish Contracts V2

The smart contract layer for the Fhish Private FHE Rollup Stack. These contracts operate on the MiniEVM L2 and manage the interaction between user transactions and the off-chain FHE decryption gateway.

## Core Contracts

### `FhishGateway.sol`
Acts as the central router for FHE decryption requests.
- Emits events when a smart contract requests a decryption of a ciphertext handle.
- The `fhish-relayer-v2` listens to these events, decrypts the ciphertexts off-chain in the WASM sandbox, and submits the decrypted results back to the Gateway (or directly to the requesting contract) using its Admin keys.

### `PrivateVotingV2.sol`
A demonstration FHE application that utilizes the FhishGateway.
- Users cast encrypted votes by submitting ciphertext handles (pointers to the 16KB FHE blobs stored in the Gateway).
- The `vote()` function accepts `handleA` and `handleB`.
- The contract maintains an encrypted tally. Once decryption is requested, the Relayer fulfills the results on-chain via the `setDecryptedResult()` or `fulfillDecryption()` callbacks.

## Development
This package uses Hardhat. The deployment script (`scripts/deploy.js`) deploys the Gateway and the Voting contract, wiring them together automatically.
