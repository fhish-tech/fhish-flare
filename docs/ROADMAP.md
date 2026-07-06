# fhish on Flare — Roadmap

Full‑time sprint to the **Flare Summer Signal** deadline: **Aug 14** (judging Aug 15–21, winners Aug 24).
~5.5 weeks from kickoff. Bounty 2 (Confidential Compute). Design tree resolved in
[ARCHITECTURE.md](ARCHITECTURE.md).

**Sequencing principle:** get **real FHE working end‑to‑end on Coston2 first** (trusted gateway), then
add the **TEE binding in sim‑mode**, then do **one real Confidential Space deploy**. Never block the
demo on GCP.

> **Progress:** M0 ✅ · M1 ✅ (real‑tfhe e2e on Coston2) · M2 ✅ (AttestationRegistry deployed + 8/8 tests) ·
> M3 ✅ artifacts ready (`tee/` — real Confidential Space runbook; needs your GCP to run) · M4 ✅ (4 apps
> deployed, FTSO + FAssets live) · M5 ⏳ (app tx proofs captured; 10‑example port + hardening remain) ·
> M6 ⏳ (SUBMISSION.md written; demo video + publish remain).

---

## M0 — Bootstrap (Day 1–2)  ·  *"clone everything, deploy the baseline"*

- [ ] Clone/fork the EVM `-v2` repos into the `fhish-flare` monorepo:
      `fhish-contracts-v2 → contracts/`, `fhish-coprocessor`+`fhish-gateway`+`fhish-wasm` → `offchain/`,
      `fhish-sdk-v2` + `fhish-relayer-v2`, `fhish-hardhat-plugin`.
- [ ] Fund the Coston2 deployer `0xcB0E…4941` via the C2FLR faucet.
- [ ] Point Hardhat + Foundry at Coston2 (chainId 114, RPC).
- [ ] `forge build` / compile `fhish-contracts-v2` clean on the EVM target.
- [ ] Deploy `FheCoprocessor` + `ConfidentialToken` to Coston2; capture addresses + a smoke‑test tx.
- **Exit:** contracts live on Coston2 with explorer proofs.

## M1 — Off‑chain on Flare (Day 3–5)  ·  *"real tfhe, real chain"*

- [ ] Swap the chain client to **ethers + Coston2**; relayer watches Coston2 `getLogs`.
- [ ] Local **end‑to‑end**: `encrypt → confidential transfer → decrypt` with **real Zama tfhe** against
      the **live Coston2** contracts (decrypts the real numbers — anti‑mock).
- [ ] Port the anti‑mock test suite (asserts real ~257 KB ciphertexts + live decryption).
- **Exit:** trusted‑gateway fhish fully working on Coston2.

## M2 — TEE binding, sim‑mode (Week 2)  ·  *"attestation, no GCP yet"*

- [ ] `AttestationRegistry.sol` — `registerEnclave(pubkey, token, measurement)` + `EnclaveAttested` event.
- [ ] Enclave **attestation module**: generate keypair in‑enclave, produce attestation token; **sim‑mode**
      emits a correctly‑shaped fake token.
- [ ] **Verify‑then‑register** flow; gateway signs all responses with the enclave key.
- [ ] SDK verifies enclave signatures against the on‑chain registry.
- [ ] Full e2e **with attestation** in sim‑mode.
- **Exit:** the complete trust story runs locally, no cloud dependency.

## M3 — Real Confidential Space (Week 2–3)  ·  *"hardware attestation, once"*

- [ ] Package the gateway as a **Confidential Space container image** (borrow the Flare AI Kit recipe).
- [ ] Spin up Confidential Space on the **GCP $300 free trial** (AMD SEV‑SNP + vTPM).
- [ ] Real **vTPM attestation token**; register the **real enclave pubkey** on Coston2.
- [ ] Run the full e2e against the **real enclave**; capture the attestation proof + `EnclaveAttested` tx.
- **Exit:** one reproducible real‑TEE run, evidenced on‑chain.

## M4 — 4 flagship apps (Week 3–4)  ·  *"the products judges test"*

- [ ] **Sealed‑bid auction** — encrypted bids, homomorphic `max`, **FTSO** reserve/settlement price.
- [ ] **Confidential FAsset balance** — private balances over **FXRP**.
- [ ] **Confidential voting / DAO** — homomorphic tally, reveal at close (optional **FDC** eligibility).
- [ ] **Confidential token** — polish the baseline.
- [ ] Each deployed to Coston2 with tx proofs + its Flare‑protocol hook working.
- **Exit:** four live confidential dApps, each with a genuine Flare integration.

## M5 — Examples + hardening (Week 4–5)  ·  *"breadth + credibility"*

- [ ] Port the 10 `fhish-examples-stellar` examples to Coston2 with tx proofs.
- [ ] Performance/durability: native `tfhe-rs` build, job queue, durable ciphertext store; contract‑storage TTL.
- [ ] Security pass (ACL correctness, sig replay, attestation‑registry admin controls); anti‑mock CI.
- **Exit:** the repo reads as serious product work, not a hack.

## M6 — Submission (Week 5–5.5)  ·  *"win the write‑up"*

- [ ] Docs + Mermaid diagrams + per‑app READMEs; **demo video**.
- [ ] Split to `fhish-flare` + `fhish-examples-flare`; publish (secret‑scan first).
- [ ] Submission packet: name, bounty, product/target‑user, demo links, **how it uses Flare**
      (Confidential Space + FTSO/FAssets/FDC), **what existed vs newly built vs ported/improved**,
      contract addresses (Coston2), roadmap/next‑steps.
- **Exit:** submitted before **Aug 14**.

---

## Post‑hackathon (next steps to state in the submission)

- **Threshold / MPC KMS** — replace the single enclave with a committee (removes the last single‑point).
- **Full on‑chain attestation verification** — Solidity verifies the vTPM/cert‑chain before accepting a pubkey.
- **Real input proofs** — replace the pass‑through with on‑chain ZK input‑validity proofs.
- **User re‑encryption** — decrypt‑to‑user‑key so even the enclave needn't return plaintext to the SDK.
- **Migrate to Flare's enshrined TEE** ("Protocol Managed Wallets") when it ships, off Google's trust root.

---

## Risk register

| Risk | Mitigation |
|---|---|
| GCP billing / Confidential Space quota eats days | Sim‑mode first; TEE is M3, never on the demo's critical path |
| FHE op latency (11–25 s wasm) | Native `tfhe-rs` build + job queue in M5; demo tolerates the wait |
| FAssets/FXRP plumbing heavy | Confidential FAsset app is scoped last among the four; token/auction carry the demo |
| Coston2 instability / faucet limits | Multiple funded keys; ret[r]y logic; addresses pinned in `.env.coston2` |
| Scope (4 apps + TEE) | Strict milestone order — trusted e2e (M1) and TEE story (M2) land before app breadth (M4) |
