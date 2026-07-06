# FHISH SDK V2 — AGENTS.md

## Tech Stack

- **Runtime**: Browser (WebAssembly) + Node.js
- **Language**: TypeScript
- **FHE Library**: `fhish-wasm` (our custom WASM, NOT `tfhe` npm)
- **Wallet**: RainbowKit + wagmi (real wallet connection)
- **Build**: tsup (CJS + ESM dual output)
- **Testing**: Vitest

## CRITICAL: No External FHE Packages

**NEVER use external FHE packages:**
- ❌ `npm install tfhe` - Browser WASM (requires Web Workers, NOT for browser)
- ❌ `npm install node-tfhe` - Node.js FHE (external dependency)
- ❌ `fhevmjs` - Zama JS SDK
- ❌ Any Zama/Fhenix npm packages

**USE our custom WASM:**
- ✅ `fhish-wasm` (packages/fhish-wasm/pkg/) - Browser WASM
- Built from tfhe-rs source in `_references/zama/tfhe-rs/`

## Build Commands

```bash
# Install dependencies (NO tfhe packages!)
npm install

# Build WASM first (if not exists)
cd ../packages/fhish-wasm
wasm-pack build --target web --out-dir pkg

# Return to SDK
cd ../fhish-sdk-v2

# Build SDK
npm run build          # CJS + ESM + types

# Development
npm run dev            # Watch mode with tsup

# Type check
npx tsc --noEmit

# Test
npm run test           # Vitest
```

## Key Files

| File | Purpose |
|------|---------|
| `src/FhishClient.ts` | Main client: init, encrypt, createEncryptedInput |
| `src/EncryptionEngine.ts` | fhish-wasm wrapper for browser |
| `src/types.ts` | TypeScript types |
| `src/utils.ts` | Utility functions |
| `src/index.ts` | Barrel exports |
| `dist/` | Build output (index.js, index.mjs, index.d.ts) |
| `lib/` | WASM files (symlink to fhish-wasm/pkg/) |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      BROWSER                            │
│                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │ RainbowKit  │───▶│ FhishSDK    │───▶│ fhish-wasm  │ │
│  │ (Wallet)    │    │   V2        │    │  (Browser)   │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
│                            │                            │
│                            ▼                            │
│                     ┌─────────────┐                     │
│                     │ Gateway     │                     │
│                     │ /get-public │                     │
│                     └─────────────┘                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Usage

### Basic Usage (Browser)

```typescript
import { FhishClient } from 'fhish-sdk-v2';

// Initialize with gateway URL
const client = await FhishClient.init('http://localhost:8080');

// Encrypt a vote
const encryptedYes = await client.encryptVote(true);  // YES = 1
const encryptedNo = await client.encryptVote(false); // NO = 0

// Get ciphertext for contract
const ciphertext = encryptedYes.serialize(); // Uint8Array
```

### With RainbowKit

```typescript
// In your wagmi config
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia } from 'wagmi/chains';

const config = getDefaultConfig({
  appName: 'FHISH Demo',
  projectId: 'your-walletconnect-project-id',
  chains: [sepolia],
});

// In your component
import { useAccount } from 'wagmi';
import { FhishClient } from 'fhish-sdk-v2';

function VoteButton({ proposalId }) {
  const { address } = useAccount();
  
  const handleVote = async (support: boolean) => {
    const client = await FhishClient.init(
      process.env.NEXT_PUBLIC_FHISH_GATEWAY_URL
    );
    
    const encryptedVote = await client.encryptVote(support);
    // Send to contract...
  };
  
  return (
    <button onClick={() => handleVote(true)}>Vote YES</button>
    <button onClick={() => handleVote(false)}>Vote NO</button>
  );
}
```

## Environment Variables

```bash
# For demo integration
NEXT_PUBLIC_FHISH_GATEWAY_URL=http://localhost:8080
FHISH_GATEWAY_URL=http://localhost:8080
```

## Key Types (from fhish-wasm)

```typescript
// Types imported from fhish-wasm (NOT from tfhe npm!)
import {
  FhisShortintConfig,       // Configuration
  FhisShortintClientKey,    // Client key (for SDK init)
  FhisShortintPublicKey,    // Public key (from gateway)
  FhisShortintUint2,        // Ciphertext type (~2-4KB)
} from 'fhish-wasm';
```

## SDK Responsibilities

1. **Initialize WASM**: Load fhish-wasm in browser
2. **Fetch Public Key**: GET `/get-public-key` from gateway
3. **Encrypt Votes**: Use shortint types (~2-4KB ciphertexts)
4. **Provide Ciphertext**: For contract interaction
5. **Handle Wallet**: Sign permits with RainbowKit/wagmi

## Demo Integration

The demo at `fhish-demo/` uses this SDK:

```typescript
// fhish-demo/lib/fhish.ts
import { FhishClient } from 'fhish-sdk-v2';

export async function getFhishClient(): Promise<FhishClient> {
  return FhishClient.init(
    process.env.NEXT_PUBLIC_FHISH_GATEWAY_URL || 'http://localhost:8080'
  );
}

// fhish-demo/components/VoteButton.tsx
import { useState } from 'react';
import { useContractWrite, useWaitForTransaction } from 'wagmi';
import { getFhishClient } from '@/lib/fhish';
import votingAbi from '@/lib/contracts/PrivateVoting.sol/PrivateVoting.json';

export function VoteButton({ proposalId, support }: { proposalId: bigint; support: boolean }) {
  const [encrypted, setEncrypted] = useState<Uint8Array | null>(null);
  
  const handleVote = async () => {
    const client = await getFhishClient();
    const result = await client.encryptVote(support);
    setEncrypted(result.serialize());
  };
  
  // ... contract write with encrypted vote
}
```

## Testing

```bash
# Run tests
npm run test

# Test encryption
node -e "
const { FhishClient } = require('./dist/index.js');
// Note: WASM requires browser environment
"
```

## Important Notes

1. **WASM Must Be Available**: Copy `fhish-wasm/pkg/` files to `lib/` directory
2. **Browser Required**: WASM runs in browser context, not Node.js
3. **Gateway Must Be Running**: SDK fetches public key from gateway
4. **Real Wallet**: Demo uses RainbowKit (not mock addresses)

## Known Limitations

- Browser WASM only (Node.js WASM is for gateway)
- Shortint types only (no FheUint32, FheBool yet)
- Single vote at a time (no batching)
