# FHISH Contracts V2 — AGENTS.md

## Tech Stack
- **Language**: Solidity 0.8.24
- **Framework**: Hardhat 2.19+
- **Testing**: Hardhat + Chai + Mocha
- **Types**: TypeScript + TypeChain
- **Libraries**: OpenZeppelin Contracts 5

## Build Commands
```bash
npm install                  # Install dependencies
npx hardhat compile          # Compile all contracts
npx hardhat test             # Run Solidity tests
npx hardhat node             # Local hardhat node
npx hardhat run scripts/deploy_gateway.ts --network sepolia  # Deploy to Sepolia
npx hardhat run scripts/verify_deployment.ts --network sepolia  # Verify deployment
```

## Key Files
- `contracts/lib/FhishTFHE.sol`       — FHE math library (add, sub, mul, etc.)
- `contracts/lib/FhishImpl.sol`       — Core implementation (IFhishExecutor calls)
- `contracts/lib/FhishConfig.sol`      — Network configuration (addresses)
- `contracts/lib/FhishACL.sol`         — Access control (transient storage)
- `contracts/lib/FhishType.sol`        — Type enums
- `contracts/lib/FhishKMSVerifier.sol` — ECDSA signature verification
- `contracts/gateway/FhishGateway.sol` — Gateway contract (relayer auth, fulfillment)
- `contracts/gateway/FhishGatewayCaller.sol` — Base for contracts requesting decrypt
- `contracts/PrivateVotingV2.sol`      — Demo: encrypted voting contract
- `contracts/SetupHelper.sol`          — Deployment helper
- `scripts/`                           — Deployment scripts
- `deployments.json`                   — Deployment addresses (generated)

## Contracts to Deploy (Sepolia)
1. FhishACL — Access control
2. FhishCoprocessor — FHE operations (via CREATE2 at deterministic address)
3. FhishGateway — Relayer-managed decryption fulfillment
4. FhishKMSVerifier — Gateway signature verification
5. FhishInputVerifier — ZK proof placeholder
6. PrivateVotingV2 — Voting demo

## Environment Variables
```
PRIVATE_KEY=0x...              # Deployer private key
SEPOLIA_RPC_URL=https://...
GATEWAY_ADDRESS=0x...          # Deployed gateway
ACL_ADDRESS=0x...              # Deployed ACL
COPROCESSOR_ADDRESS=0x...     # Deployed coprocessor
```

## Architecture
All FHE operations delegate to FhishCoprocessor at deterministic address.
FhishGateway manages decryption fulfillment with relayer whitelisting.
FhishACL enforces transient access control per EIP-1153.
Never references Zama infrastructure.
