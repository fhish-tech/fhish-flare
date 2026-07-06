# fhish-flare TEE layer — Flare Confidential Compute (Google Cloud Confidential Space)

This is the piece that makes fhish's keyholder **untrusted**. The gateway runs inside a
Confidential Space enclave (AMD SEV-SNP + vTPM); its decryption-signing key is generated **inside**
the TEE, and a vTPM attestation token binds *{enclave image → signing key}*. Our off-chain verifier
checks that token and calls `AttestationRegistry.registerEnclave(...)` on Coston2, which makes the
attested key the **only** authorized KMS signer and emits an on-chain audit event.

## Two paths, one contract interface

| Path | Attestation token | Needs GCP? | Status |
|---|---|---|---|
| **SIM** (dev) | a correctly-shaped fake, via `contracts/scripts/deploy_coston2.ts` | ❌ | ✅ **working, proven on-chain** |
| **REAL** (this dir) | a genuine Confidential Space vTPM OIDC token | ✅ | ✅ **drop-in — runbook below** |

The on-chain contracts (`AttestationRegistry`, hardened `FhishKMSVerifier`) are **identical** for both.
Swapping sim→real changes only *where the token comes from* — zero contract changes.

## Components

- [`enclave/attest.mjs`](enclave/attest.mjs) — runs **inside** the enclave next to the gateway:
  generates the signing key in-TEE, requests a CS attestation token whose nonce binds to the key's
  address, and serves `{ address, attestationToken }` on `:9000/enclave-identity`.
- [`verifier/register-enclave.mjs`](verifier/register-enclave.mjs) — runs **outside**: verifies the CS
  token (Google JWKS + issuer + nonce binding + image digest → measurement), then `registerEnclave(...)`.
- [`Dockerfile`](Dockerfile) — packages the gateway + attester into the CS enclave image (its digest is
  the attested measurement).
- [`deploy-confidential-space.sh`](deploy-confidential-space.sh) — build → push → launch the CS VM.

## Runbook (real Confidential Space)

```bash
# 0. Prereqs: GCP project + billing (free $300 trial is enough), gcloud authed.
export GCP_PROJECT=your-project-id

# 1. Build the enclave image, launch the Confidential Space VM.
bash tee/deploy-confidential-space.sh          # prints the VM IP + the image digest (measurement)

# 2. (Optional) pin the expected measurement so only THIS image can be registered:
#    call AttestationRegistry.setMeasurementAllowlist(true) + approveMeasurement(<digest hash>, true)

# 3. Verify the enclave attestation and bind its key on-chain (verify-then-register):
cd tee/verifier && npm i jose ethers && cd ../..
ENCLAVE_URL=http://<VM_IP>:9000 node tee/verifier/register-enclave.mjs
#   -> verifies the vTPM token, then AttestationRegistry.registerEnclave(...) on Coston2
#   -> gatewaySigner is now the attested enclave key; EnclaveAttested event is the audit trail
```

From here the whole flow is identical to the sim demo (`offchain/gateway/e2e-coston2.mjs`), except the
KMS signer is now provably an attested TEE.

## Trust boundary (honest)

- Removes: operator's ability to read plaintext or exfiltrate the FHE key (TEE-isolated memory).
- Root of trust: AMD SEV-SNP + Google's CS attestation service (documented, not hidden).
- Residual: single enclave (threshold KMS is roadmap); v1 verify-then-register uses an off-chain
  verifier + on-chain audit event (full on-chain vTPM/cert-chain verification is a post-hackathon upgrade).
- Migration target: Flare's enshrined TEE ("Protocol Managed Wallets") when it ships.

## References

- Confidential Space attestation tokens: https://cloud.google.com/confidential-computing/confidential-space/docs/reference-tokens
- Flare AI Kit (the blessed CS path): https://github.com/flare-foundation/flare-ai-kit
