# fhish-flare

**Fully Homomorphic Encryption for Flare — with a keyholder nobody has to trust.**

A port of [**fhish**](https://github.com/fhish-tech) (a plug-and-play FHE module for EVM, inspired by
Zama's fhEVM and Fhenix) to **Flare Network**, integrated with **Flare Confidential Compute** so the
FHE gateway's key lives inside a hardware-attested TEE and its identity is bound **on-chain**.

Built for **Flare Summer Signal — Bounty 2 (Confidential Compute)**.

---

## The idea in one paragraph

FHE lets many parties compute over encrypted data (`compare`, `select`, arbitrary functions) without
anyone decrypting — its real strength is **composable confidential compute**, not just private payments.
Its one weakness is a **trusted keyholder**: a gateway holds the FHE secret key and signs decryptions.
On Flare we remove that assumption. The gateway runs inside a **Google Cloud Confidential Space** enclave
(AMD SEV-SNP + vTPM — the path Flare blesses via the Flare AI Kit). The signing key is generated
**inside the TEE**, a vTPM attestation binds *{enclave measurement → pubkey}*, and our
[`AttestationRegistry`](contracts/contracts/attestation/AttestationRegistry.sol) records it on-chain and
makes it the **only** authorized decryption signer. **"Trust me, I won't peek" becomes "hardware says it
can't peek, and here's the on-chain proof."**

Because **Flare is EVM-compatible and fhish began as an EVM module**, this is a "return home" port: the
contracts are the original Solidity (`fhish-contracts-v2`), the off-chain coprocessor is reused as-is, and
the new work is the **TEE binding** + **Flare data-protocol hooks** (FTSO / FAssets / FDC).

## Live on Coston2 testnet (chainId 114)

| Contract | Address |
|---|---|
| FhishACL | [`0x99675be6298073935828fDE3D73bFB88A885A400`](https://coston2-explorer.flare.network/address/0x99675be6298073935828fDE3D73bFB88A885A400) |
| FhishKMSVerifier (hardened) | [`0x2318DAf8c4A75a0ff326217c52ef0FE7db39b5e3`](https://coston2-explorer.flare.network/address/0x2318DAf8c4A75a0ff326217c52ef0FE7db39b5e3) |
| FhishGateway | [`0xA5756A29FFe85cB891a1C60fE7FAFcDd8746C039`](https://coston2-explorer.flare.network/address/0xA5756A29FFe85cB891a1C60fE7FAFcDd8746C039) |
| **AttestationRegistry** | [`0x9a94dd884353a1Bab7a944bA7f4Fe23FA04B4F10`](https://coston2-explorer.flare.network/address/0x9a94dd884353a1Bab7a944bA7f4Fe23FA04B4F10) |
| PrivateVotingV2 (demo) | [`0x3F561ae7aEdfdf7cc9e97eE9CaeeC628e7Ca62B2`](https://coston2-explorer.flare.network/address/0x3F561ae7aEdfdf7cc9e97eE9CaeeC628e7Ca62B2) |

Full record: [`deployments/coston2.json`](deployments/coston2.json).

## Status

| Layer | State |
|---|---|
| Monorepo bootstrapped from the EVM `-v2` repos | ✅ done |
| Contracts compile + deploy on Coston2 (`cancun`) | ✅ done |
| **AttestationRegistry** (enclave-bound key, verify-then-register, audit event) | ✅ done, deployed |
| **Hardened `FhishKMSVerifier`** (signer gated behind attestation — fixes an open `setGatewaySigner`) | ✅ done, deployed |
| Attestation flow proven on-chain + **8/8 unit tests** | ✅ done |
| **Real Zama-tfhe e2e on Coston2** (enc→homomorphic compute→decrypt→attested on-chain verify) | ✅ done ([e2e](offchain/gateway/e2e-coston2.mjs)) |
| SIM-attestation dev mode (no GCP needed) | ✅ done |
| **4 flagship apps** — auction@FTSO · token · FAsset@FXRP · voting | ✅ deployed, [tx proofs](examples/proofs.json) |
| Live **FTSOv2** (FLR/USD) + **FAssets** (FXRP) reads on-chain | ✅ done |
| Real Google Cloud Confidential Space deploy (drop-in runbook, needs your GCP) | ✅ artifacts ready ([tee/](tee/README.md)) |
| Demo video, publish `fhish-flare` + `fhish-examples-flare` | ⏳ handoff |

Live apps on Coston2: [SealedBidAuction](https://coston2-explorer.flare.network/address/0x2123313800f37fa2Fc9D672D5126Da8Ac6375C1D) (FTSO reserve) ·
[ConfidentialToken](https://coston2-explorer.flare.network/address/0x33AfEA1582e143D47C391cbE7F59a84e40f5A619) ·
[ConfidentialFAsset](https://coston2-explorer.flare.network/address/0x6c8EE727F5613545CcdAF8905683EB5229a706b9) (FXRP) ·
[PrivateVotingV2](https://coston2-explorer.flare.network/address/0x3F561ae7aEdfdf7cc9e97eE9CaeeC628e7Ca62B2).

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/ROADMAP.md`](docs/ROADMAP.md), and
[`docs/SUBMISSION.md`](docs/SUBMISSION.md).

## Repo layout

```
contracts/   Solidity (fork of fhish-contracts-v2) + attestation/AttestationRegistry.sol + tests
             scripts/deploy_coston2.ts  ← full-stack deploy + sim-attestation binding
offchain/    coprocessor + gateway + relayer + sdk + vendor/fhish-wasm (chain-agnostic, runs in the TEE)
docs/        ARCHITECTURE.md · ROADMAP.md
deployments/ coston2.json
```

## Quick start

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test test/AttestationRegistry.test.ts          # 8/8 — proves the trust upgrade
npx hardhat run scripts/deploy_coston2.ts --network coston2 # full-stack deploy + attestation
```

Requires `contracts/.env` with `PRIVATE_KEY` (a Coston2-funded key) and optionally `COSTON2_RPC_URL`.

## Credit

Original **fhish** by [nickthelegend](https://github.com/nickthelegend) / [fhish-tech](https://github.com/fhish-tech);
FHE by Zama [`tfhe-rs`](https://github.com/zama-ai/tfhe-rs). Confidential Compute via Google Cloud
Confidential Space / [Flare AI Kit](https://github.com/flare-foundation/flare-ai-kit).
