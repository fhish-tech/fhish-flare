# FHISH Coprocessor — AGENTS.md

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **FHE Library**: `fhish-wasm` (our custom WASM, NOT `tfhe` npm)
- **HTTP**: Express 4
- **Architecture**: Off-chain FHE computation service

## CRITICAL: No External FHE Packages

**NEVER use external FHE packages:**
- ❌ `npm install tfhe` - Browser WASM (requires Web Workers)
- ❌ `npm install node-tfhe` - Node.js FHE (external dependency)
- ❌ `fhevmjs` - Zama JS SDK
- ❌ `fhenixjs` - Fhenix SDK
- ❌ Any Zama/Fhenix npm packages

**USE:**
- ✅ `fhish-wasm` (packages/fhish-wasm/pkg-node/) - Our custom WASM
- Built from tfhe-rs source in `_references/zama/tfhe-rs/`

## Build Commands

```bash
# Install dependencies (NO tfhe packages!)
npm install

# Build WASM first
cd ../packages/fhish-wasm
wasm-pack build --target nodejs --out-dir pkg-node
cd ../packages/fhish-coprocessor

# Start
npm run dev              # Development mode (tsx watch)
npm run build            # TypeScript compile
npm start                # Production server
```

## Environment Variables

```bash
PORT=8082
COPROCESSOR_WASM=http://localhost:8080/tfhe_bg.wasm
```

## API Endpoints

### POST /fhe/add
```json
{
  "lhs": "0xabc123...",
  "rhs": "0xdef456...",
  "type": "euint32"
}
```

### POST /fhe/sub
### POST /fhe/mul
### POST /fhe/eq
### POST /fhe/ne
### POST /fhe/gt
### POST /fhe/ge
### POST /fhe/lt
### POST /fhe/le
### POST /fhe/ifthenelse
```json
{
  "control": "0xabc...",
  "ifTrue": "0xdef...",
  "ifFalse": "0x123...",
  "type": "euint32"
}
```

### POST /fhe/trivial-encrypt
```json
{
  "value": 42,
  "type": "euint32"
}
```

### POST /fhe/batch-add
```json
{
  "operands": ["0xabc...", "0xdef...", "0x123..."],
  "type": "euint32"
}
```

## Architecture

```
┌─────────────────────────────────────────────┐
│          FHISH Coprocessor Service          │
├─────────────────────────────────────────────┤
│  Express Server (Port 8082)                │
│  ├── /fhe/* - FHE Operations               │
│  └── /health - Health check                │
├─────────────────────────────────────────────┤
│  fhish-wasm (Node.js WASM)                 │
│  ├── Server Key (generated at startup)      │
│  ├── FHE Arithmetic (add, sub, mul)         │
│  └── FHE Comparison (eq, gt, lt, etc.)     │
└─────────────────────────────────────────────┘
          │
          │ HTTP POST /fhe/add
          ▼ (or other operations)
┌─────────────────────────────────────────────┐
│       FhishCoprocessor.sol (on-chain)      │
└─────────────────────────────────────────────┘
```

## Key Features

- **Independent**: Built from tfhe-rs source (no Zama packages)
- **Fast**: All FHE operations run off-chain
- **Scalable**: Can be deployed to multiple instances
- **Compatible**: Works with fhish-sdk-v2 encryption
