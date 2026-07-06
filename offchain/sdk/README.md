# Fhish SDK V2

The standard TypeScript SDK for interacting with the Fhish Private FHE Rollup Stack. This SDK provides a simple abstraction for DApp developers to encrypt data, submit ciphertexts to the Fhish Gateway, and cast on-chain transactions using standard `ethers.js` providers.

## Core Components

- **`FhishClient`**: The primary entry point. Manages connection to both the EVM network (via `ethers`) and the FHE Gateway HTTP API.
- **`encrypt()`**: Helper method that fetches the public FHE key from the gateway, encrypts a primitive value (e.g., `uint32`), and automatically POSTs the ciphertext blob to the Gateway, returning a 32-byte `handle`.
- **Contract Integration**: The `handle` returned by the SDK can be passed directly as a `bytes32` argument into any Fhish-compatible smart contract.

## Example Flow
```typescript
const client = new FhishClient({ gatewayUrl: "http://localhost:8080" });
await client.init();

// 1. Encrypt and upload
const handle = await client.encrypt(1); // Returns 0x...

// 2. Submit to smart contract
const tx = await votingContract.vote(handle, "0x000...", "0x", "0x");
await tx.wait();
```
