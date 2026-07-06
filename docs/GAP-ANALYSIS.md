# fhish vs Zama fhEVM / Fhenix — honest gap analysis

Where fhish stands relative to the two production FHE-on-EVM protocols, after the confidential-auction
work. No spin — this is the doc to read before claiming parity.

## Now at parity (built + proven on Coston2)

| Capability | Zama/Fhenix | fhish | Evidence |
|---|---|---|---|
| Solidity encrypted types + `FHE` API | ✅ | ✅ `FHE.sol` (`euint32`, `ebool`, `externalEuint32`) | [FHE.sol](../contracts/contracts/lib/FHE.sol) |
| On-chain FHE ops execute | ✅ | ✅ symbolic executor emits the op graph | `wire_fhe.ts` |
| **Private client-encrypted inputs** | ✅ | ✅ `encrypt_with_public_key`, `FHE.fromExternal` | auction e2e (bids never public) |
| Real homomorphic compute | ✅ | ✅ Zama `tfhe-rs` `max/min/gt/add` off-chain | auction: `max(42,77,30)=77` |
| **Selective decryption** | ✅ | ✅ only the clearing price revealed | losing bids 42 & 30 stay secret |
| **On-chain ACL, gated decrypt** | ✅ | ✅ `FHE.allow`, gateway checks `isAllowed` | `isAllowed=true` self-decrypt |
| Async decryption (request→callback) | ✅ | ✅ gateway `requestDecryption`/`fulfill` | auction `close()` → `fulfillClearingPrice` |
| Signature-verified fulfillment | ✅ | ✅ `FhishKMSVerifier` | 19 unit tests |
| Enshrined-data integration | — | ✅ FTSOv2 + FAssets (Flare-specific edge) | live FLR/USD reserve |

## Still roadmap (honest — these are real gaps)

| Gap | Zama/Fhenix | fhish today | Severity |
|---|---|---|---|
| **Input proofs (ZKPoK)** | client proves ciphertext well-formedness + plaintext knowledge (`InputVerifier`) | **pass-through** (coprocessor trusts inputs) | 🔴 security |
| **Threshold / MPC KMS** | decryption split across an *n*-party network; no single key | **single trusted gateway key** (same as Zama *testnet*) | 🔴 decentralization |
| **User re-encryption / sealed output** | `sealoutput`/reencrypt to user pubkey — user-only reveal | self-decrypt via ACL, but **not yet reencrypt-to-user-key** | 🟠 privacy |
| **Full type/op coverage** | euint4…256, eaddress, ebytes; all ops | coprocessor materializes **euint32 + max/min/gt/add** | 🟡 breadth |
| **Persistent coprocessor daemon** | always-on distributed service | **event-driven script** (logic proven, not a daemon) | 🟡 ops |
| **Production performance** | native `tfhe-rs`, GPU/AES-NI, HCU gas metering | wasm, ~single-digit-second ops | 🟡 perf |
| **Maturity** | audits, mainnet, tooling | testnet, unaudited | 🟡 |

## Bottom line

The **conceptual core is now at parity**: a developer writes `FHE.max` over client-encrypted inputs and
gets a confidential result with only the intended value revealed — proven on Coston2. The remaining gaps
are **decentralization and hardening** (input proofs, threshold KMS, reencryption) plus **scale-up**
(type breadth, daemon, performance, audits) — not conceptual holes. fhish is an honest, working
FHE-on-Flare protocol in the Zama/Fhenix lineage, with a testnet trust model Zama themselves ship today.
