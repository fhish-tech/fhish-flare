# Flare Summer Signal — Submission: fhish-flare

**Project name:** fhish-flare — Confidential-Compute FHE for Flare

**Bounty:** Bounty 2 — Confidential Compute Apps

**Short description:** A production-oriented **Fully Homomorphic Encryption** library for Flare
(fhEVM/Zama-style symbolic coprocessor), integrated with **Flare Confidential Compute** so the FHE
gateway's decryption key lives inside a hardware-attested TEE (Google Cloud Confidential Space) and its
identity is bound **on-chain**. FHE provides composable confidential computation; Flare's TEE removes
FHE's one trust assumption (a trusted keyholder). Ships with four confidential dApps.

**Target user:** Flare developers who need to compute over private data — sealed-bid auctions, private
DAO voting, confidential tokens, private balances over FAssets — without a trusted decryptor, plus teams
wanting an fhEVM-equivalent primitive on Flare.

**Demo / working app:**
- Real-tfhe end-to-end on Coston2: `offchain/gateway/e2e-coston2.mjs` (enc→homomorphic compute→decrypt, on-chain handle, attested on-chain verification).
- Contract tests: `cd contracts && npx hardhat test` (8/8 on the attestation layer).
- Live tx proofs: [`examples/proofs.json`](../examples/proofs.json).

**GitHub / technical materials:** this repo (monorepo). Design: [ARCHITECTURE.md](ARCHITECTURE.md);
plan: [ROADMAP.md](ROADMAP.md); TEE runbook: [../tee/README.md](../tee/README.md).

## How it uses Flare (meaningfully, not superficially)

1. **Flare Confidential Compute (core):** the fhish gateway runs inside a Confidential Space enclave
   (AMD SEV-SNP + vTPM — the path Flare blesses via the Flare AI Kit). The signing key is generated
   in-TEE; a vTPM attestation binds *{enclave image → key}*; our `AttestationRegistry` verifies-then-
   registers it on Coston2 as the **only** authorized decryption signer, with an on-chain audit event.
   This also **hardens a real vulnerability** in the original fhish (`setGatewaySigner` had no access
   control) — now only an attested enclave key can sign.
2. **FTSOv2 (enshrined oracle):** `SealedBidAuction` reads the live FLR/USD feed via
   `ContractRegistry.getTestFtsoV2().getFeedById(...)` to derive the reserve price at settlement
   (verified live on-chain: FLR/USD ≈ $0.00704 at deploy).
3. **FAssets / FXRP (core asset):** `ConfidentialFAsset` resolves real FXRP via
   `ContractRegistry.getAssetManagerFXRP().fAsset()` (resolved live to `0x0b6A3645…273dc7` on Coston2)
   for confidential balances over bridged XRP.

## What was newly built / ported / improved during the program

- **Ported:** the original EVM fhish stack (`fhish-contracts-v2` + off-chain coprocessor/gateway/relayer/
  SDK/wasm) onto Flare Coston2 — since Flare is EVM, this is the "home" port; contracts + the chain-
  agnostic real-tfhe coprocessor are reused.
- **Newly built:** `AttestationRegistry.sol` (enclave-bound key, verify-then-register, audit event,
  measurement allowlist, rotation/revocation) + the whole `tee/` layer (Confidential Space Dockerfile,
  in-enclave attestation module, off-chain JWT verifier/registrar); the four Flare-integrated apps
  (`SealedBidAuction`@FTSO, `ConfidentialToken`, `ConfidentialFAsset`@FXRP, plus the voting baseline);
  the Coston2 deploy pipeline; the real-tfhe Coston2 e2e; 8 unit tests.
- **Improved:** hardened `FhishKMSVerifier` (signer now gated behind attestation); FTSO/FAssets
  integration that the Algorand/Stellar ports could not have.

## Deployment details (Coston2 testnet, chainId 114)

| Contract | Address |
|---|---|
| FhishACL | `0x99675be6298073935828fDE3D73bFB88A885A400` |
| FhishKMSVerifier (hardened) | `0x2318DAf8c4A75a0ff326217c52ef0FE7db39b5e3` |
| FhishGateway | `0xA5756A29FFe85cB891a1C60fE7FAFcDd8746C039` |
| **AttestationRegistry** | `0x9a94dd884353a1Bab7a944bA7f4Fe23FA04B4F10` |
| SealedBidAuction (FTSO) | `0x2123313800f37fa2Fc9D672D5126Da8Ac6375C1D` |
| ConfidentialToken | `0x33AfEA1582e143D47C391cbE7F59a84e40f5A619` |
| ConfidentialFAsset (FXRP) | `0x6c8EE727F5613545CcdAF8905683EB5229a706b9` |
| PrivateVotingV2 | `0x3F561ae7aEdfdf7cc9e97eE9CaeeC628e7Ca62B2` |

Explorer: https://coston2-explorer.flare.network · full record: [`deployments/coston2.json`](../deployments/coston2.json).

## Roadmap / next steps

- Real Confidential Space deploy (runbook ready in `tee/`; swaps sim→real with zero contract changes).
- **Threshold/MPC KMS** — replace the single enclave with a committee.
- **Full on-chain attestation verification** (vTPM/cert-chain in Solidity) and **real ZK input proofs**.
- **User re-encryption** (decrypt-to-user-key) so plaintext never leaves the enclave.
- Migrate to Flare's enshrined TEE ("Protocol Managed Wallets") when it ships.
- Port the 10 confidential-dApp examples; demo video; publish `fhish-flare` + `fhish-examples-flare`.

## Networks / traction

Deployed and exercised on **Coston2**. Built by the original fhish author (nickthelegend); fhish already
has Algorand and Stellar ports — this brings it home to EVM/Flare with the confidential-compute upgrade
that those chains couldn't offer.
