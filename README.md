# fhish — Confidential Smart Contracts for Flare

**FHE for Flare. Write `euint32`, get encrypted on-chain state — the fhEVM developer experience, on Flare.**

fhish is a Fully Homomorphic Encryption protocol for Flare Network, in the lineage of **Zama's fhEVM**
and **Fhenix**. Developers write ordinary Solidity against an encrypted type system (`euint32`, `ebool`)
using the [`FHE`](contracts/contracts/lib/FHE.sol) library; inputs are client-encrypted, all homomorphic
math runs off-chain in the fhish coprocessor, and results are decrypted by a gateway under on-chain ACL.

Built for **Flare Summer Signal — Bounty 2 (Confidential Compute)**. By nickthelegend (fhish author).

```solidity
// A confidential auction — bids are encrypted, the winner computed homomorphically, only the price revealed.
using FHE for euint32;

function placeBid(externalEuint32 encBid, bytes calldata proof) external {
    euint32 bid = FHE.fromExternal(encBid, proof);   // private client-encrypted input
    FHE.allowThis(bid); FHE.allow(bid, msg.sender);   // ACL
    highestBid = initialized ? FHE.max(highestBid, bid) : bid;  // homomorphic — no plaintext on-chain
}
```

## How it works (the fhEVM model, on Flare)

| Layer | What it does |
|---|---|
| **`FHE.sol`** (Solidity) | Encrypted types + ops (`add/sub/mul/min/max/lt/gt/eq/select`), ACL, input binding. Ops emit a symbolic graph — the chain never sees plaintext. |
| **`FhishCoprocessor`** (on-chain) | Derives a deterministic typed handle per op and emits `FheOp`/`VerifyInput` events. No FHE math on-chain (an EVM can't). |
| **Coprocessor** (off-chain) | Watches those events, materializes the **real Zama `tfhe-rs` ciphertext** for each handle, computes homomorphically. |
| **Gateway / KMS** | Holds the FHE secret key; decrypts a handle **only for ACL-authorized callers**; verifies via `FhishKMSVerifier`. |
| **Flare integration** | Confidential apps read **FTSOv2** price feeds and **FAssets (FXRP)** — confidential DeFi over real Flare data. |

## What's real, tested, and live on Coston2

- ✅ **On-chain `FHE`/`TFHE` executes on Flare** — `FHE.max`, `FHE.add`, etc. emit a real symbolic graph (was reverting before; now works via the symbolic `FhishCoprocessor`).
- ✅ **Private inputs** — bids are `encrypt_with_public_key`; **no plaintext ever on-chain**.
- ✅ **Real homomorphic compute** — the coprocessor runs real Zama `tfhe-rs` `max`/`min`/`gt`/`add` over ciphertexts.
- ✅ **Selective decryption** — only the winning clearing price is revealed; **losing bids stay secret forever**.
- ✅ **ACL-gated self-decrypt** — a bidder can decrypt their own bid; the gateway checks on-chain `isAllowed`.
- ✅ **Flare data** — live FTSOv2 FLR/USD reserve; FAssets FXRP resolved on-chain.
- ✅ **19 unit tests** + end-to-end scripts, all green on live Coston2.

## Honest trust model (as Zama is about their testnet)

- **Trusted gateway (today).** A single gateway holds the FHE secret key and performs decryption. This
  is exactly where Zama's own testnet sits. **Threshold/MPC KMS is roadmap.**
- **Input proofs are a pass-through.** Real ZK proofs-of-knowledge for ciphertext well-formedness
  (Zama's `InputVerifier`) are **roadmap**; today the coprocessor trusts submitted ciphertexts.
- **What is real:** the homomorphic math (Zama `tfhe-rs`), the symbolic handle graph, the on-chain ACL,
  private client-encrypted inputs, and selective ACL-gated decryption. Nothing about the crypto is mocked.

See [`docs/GAP-ANALYSIS.md`](docs/GAP-ANALYSIS.md) for the full, honest comparison to Zama/Fhenix.

## Deployed on Coston2 (chainId 114)

| Contract | Address |
|---|---|
| FHE library / `FhishCoprocessor` (symbolic executor) | `0x978F7298Ae2ac2fB4Ba1a3D4C05f6bbAb3B49291` |
| FhishACL | `0x99675be6298073935828fDE3D73bFB88A885A400` |
| FhishGateway | `0xA5756A29FFe85cB891a1C60fE7FAFcDd8746C039` |
| FhishKMSVerifier | `0x2318DAf8c4A75a0ff326217c52ef0FE7db39b5e3` |
| **ConfidentialAuction** (flagship) | `0x04FAb1Dc38bC97Ed7a305dc940d9CcED91056Fdb` |

Full record: [`deployments/coston2.json`](deployments/coston2.json). Explorer: https://coston2-explorer.flare.network

## Quick start

```bash
cd contracts && npm install && npx hardhat compile && npx hardhat test    # 19/19
npx hardhat run scripts/wire_fhe.ts --network coston2                      # prove on-chain FHE executes
# full confidential auction (private bids -> homomorphic max -> reveal only the winner):
cd ../offchain/gateway && node --import ./src/polyfill.mjs confidential-auction-e2e.mjs
```

## Credit

Original **fhish** by [nickthelegend](https://github.com/nickthelegend) / [fhish-tech](https://github.com/fhish-tech).
FHE by Zama [`tfhe-rs`](https://github.com/zama-ai/tfhe-rs). Positioned after Zama fhEVM & Fhenix.
