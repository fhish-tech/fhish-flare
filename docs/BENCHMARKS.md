# fhish-flare — Benchmarks (honest, measured)

Numbers measured on this project (Zama `tfhe-rs` compiled to **single-threaded wasm**, the vendored
`fhish-wasm` build), on a dev laptop / Coston2. They're intentionally unflattering — the point is to show
exactly where the **native `tfhe-rs` performance** roadmap item bites.

## Sizes

| Artifact | Size | Notes |
|---|---|---|
| euint32 ciphertext | **~263 KB** | measured in every e2e (`263448` bytes serialized) |
| euint64 ciphertext | ~263 KB | same order as euint32 for this param set |
| compact public key | ~1.0 MB | fetched by the SDK/relayer to encrypt inputs |
| **server (evaluation) key** | **~120 MB** | needed for every homomorphic op; dominates load time |
| client (secret) key | ~24 KB | held by the gateway/KMS |
| on-chain handle | **32 bytes** | this is all that ever touches the chain |

## Latency (single-threaded wasm)

| Step | Time | Notes |
|---|---|---|
| Key generation (one-time) | **~41 s** | `FhisClientKey.generate` + server/public keys |
| Server-key load (per process start) | **tens of seconds** | deserializing the 120 MB key — the main startup cost |
| Encrypt (public key) | ~single-digit seconds | per input |
| Homomorphic op (add/min/gt) | **~seconds** | per op, single-threaded |
| Decrypt | sub-second | |

## What this means

- **On-chain cost is tiny** — only 32-byte handles + events. Gas is normal EVM gas; the FHE weight is
  entirely off-chain. This is the whole point of the coprocessor model.
- **Off-chain is the bottleneck**, and it's an *engineering* one, not a protocol one:
  - a **native `tfhe-rs`** build (AES-NI / AVX-512 / GPU) is ~orders of magnitude faster than wasm,
  - the 120 MB server key loads once and stays resident in a long-running relayer (don't reload per request),
  - ops should run in a **job queue** with parallel workers, and results cached by handle.
- These are exactly the items in [DEPLOYMENT.md](DEPLOYMENT.md) → "Performance" and
  [GAP-ANALYSIS.md](GAP-ANALYSIS.md). None change the contracts or the developer API.

## Reproduce

```bash
cd offchain/gateway
node --import ./src/polyfill.mjs features-e2e.mjs   # euint64 + verifiable randomness, with timings in logs
```
