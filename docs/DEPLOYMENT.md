# Deploying fhish to production — steps & blockers

Honest guide to taking fhish from Coston2 testnet to a production deployment (Flare mainnet), and the
real blockers between here and "production-grade like Zama."

## The three moving parts

| Part | What | Where it runs |
|---|---|---|
| **Contracts** | `FhishCoprocessor` (symbolic executor), `FhishACL`, `FhishGateway`, `FhishKMSVerifier`, app contracts | on-chain (Flare) |
| **Relayer / coprocessor / gateway** | `relayer-daemon.mjs` — holds FHE keys, materializes ciphertexts, decrypts under ACL | off-chain server (VM/container) |
| **Frontend** | RainbowKit dApp | any static host |

## Step-by-step (Coston2 → mainnet)

1. **Fund a mainnet deployer** with real FLR (mainnet chainId 14; the `flare` network is already in `hardhat.config.ts`).
2. **Deploy contracts:** `npx hardhat run scripts/deploy_coston2.ts --network flare` (rename/point at flare), then `deploy_apps.ts` / `deploy_voting.ts`. Record addresses.
3. **Wire the executor:** `wire_fhe.ts` to deploy + set the `FhishCoprocessor` and `setCoprocessor` on each app (apps already do this in-constructor).
4. **Run the relayer** on a server (see below). Register its address as a gateway relayer; set the gateway signer.
5. **Point the frontend** at the mainnet addresses + relayer URL. Deploy the static build.

## Running the relayer in production

- **Host:** a small always-on Linux VM or container (e.g. a 2-vCPU box). It is off-chain and stateful.
- **Secrets:** the FHE `client.bin` (secret key) + the relayer/gateway signing keys must live on that host.
  Treat them like an HSM secret. Today this is a **single trusted key** — the honest trust weak point.
- **Process:** `node --import ./src/polyfill.mjs relayer-daemon.mjs` behind a process manager (systemd/pm2)
  + a reverse proxy (TLS). Expose only `/public-key`, `/encrypt*`, `/health`.
- **Durability:** persist the ciphertext store (today it's in-memory; add a disk/DB store for restarts).

## Blockers to "production-grade" (honest, prioritized)

| Blocker | Why it matters | Effort |
|---|---|---|
| ✅ **Threshold KMS committee (M-of-N)** | DONE — `ThresholdKMSVerifier`: no single operator can authorize a decryption on-chain (proven 2-of-3 on Coston2). | shipped |
| 🔴 **MPC key-sharing** | each operator can still decrypt off-chain; ≥t must *agree* on-chain. True threshold-FHE (no operator ever sees the key) is the remaining depth. | large (research-grade) |
| 🔴 **Input proofs (ZKPoK)** | without them a malicious client can submit malformed ciphertexts / lie about a handle. Need Zama-style `InputVerifier` ZK proofs. | large (research-grade) |
| 🟠 **In-memory ciphertext store** | relayer restart loses state. | small (Postgres/S3-backed store) |
| 🟠 **Performance** | wasm tfhe ops ~seconds; server key is 120 MB. Need native `tfhe-rs` build (AES-NI/GPU) + a job queue. | medium |
| 🟠 **Client-side encryption** | demo relayer encrypts ballots; production must encrypt in-browser (fhish-wasm web build) so the relayer never sees plaintext. | medium |
| 🟠 **Contract storage TTL / handle GC** | encrypted state + handle bookkeeping grows unbounded. | medium |
| 🟡 **Audits** | unaudited contracts + off-chain code. | external |
| 🟡 **Flare mainnet EVM parity** | confirm `cancun` opcodes on mainnet (Coston2 works; verify mainnet). | small (verify) |
| 🟡 **Relayer HA** | single relayer = single point of failure/liveness. | medium (multi-relayer) |

## What IS production-ready today

Contracts compile + deploy on Flare (cancun); the symbolic executor + FHE library work; the coprocessor
materializes real Zama tfhe; ACL-gated decryption; FTSO/FAssets integration; 37 unit tests. The gap to
production is **decentralizing the gateway (threshold KMS) and hardening inputs (ZKPoK)** — the same two
things that separate Zama's testnet from their mainnet ambitions.
