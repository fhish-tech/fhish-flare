# fhish-flare — Security Audit (self-audit)

Adversarial review of the whole stack (contracts, gateway/relayer/coprocessor, crypto, frontend). This
is an **honest internal audit** — several findings are **critical** and undermine the confidentiality /
integrity claims. **Do not deploy to mainnet or hold real value until the Critical + High items are fixed.**

Scope reviewed: `contracts/contracts/**`, `offchain/gateway/**`, `offchain/coprocessor/**`, `frontend/**`.

## Severity summary

| # | Severity | Finding | Location |
|---|---|---|---|
| C1 | 🔴 Critical | Decryption signatures are **optional** — threshold KMS not enforced | `FhishGateway.fulfillPublicDecryption` / `…NoVerify` |
| C2 | 🔴 Critical | `FhishACL.allow` has **no access control** — anyone grants themselves decrypt rights | `FhishACL.sol` |
| C3 | 🔴 Critical | `ConfidentialFAsset.fulfillWithdraw` **no access control** — drain all FXRP escrow | `ConfidentialFAsset.sol` |
| H1 | 🟠 High | `recomputeBalances` **no access control** — forge any balance | `ConfidentialToken.sol`, `ConfidentialFAsset.sol` |
| H2 | 🟠 High | Input proofs are **pass-through** — unauthenticated / ill-formed inputs | `FhishCoprocessor.verifyCiphertext` |
| H3 | 🟠 High | Deployed apps use the **single-signer** gateway, not the threshold one | `deployments/coston2.json` |
| M1 | 🟡 Medium | Re-encryption permit is **replayable** (no nonce/expiry/chainId/contract) | `reencrypt.mjs` |
| M2 | 🟡 Medium | ECIES is **non-standard** (sha256(secret) as key, no HKDF/domain sep) | `reencrypt.mjs` |
| M3 | 🟡 Medium | Gateway callback is an arbitrary external call (reentrancy surface) | `FhishGateway.fulfillPublicDecryption` |
| L1 | 🔵 Low | Relayer `/encrypt*` endpoints unauthenticated (DoS/resource abuse) | `relayer-daemon.mjs` |
| L2 | 🔵 Low | FHE secret key on a single relayer disk (documented single point) | `.secrets/fhe-keys` |
| L3 | 🔵 Low | Frontend uses `http://` relayer + placeholder WC projectId | `frontend/` |

---

## Critical

### C1 — Threshold KMS is advisory, not enforced
`fulfillPublicDecryption` only verifies signatures **when `signatures.length > 0`**; with an empty array
it fulfils with **no** committee approval. `fulfillPublicDecryptionNoVerify` skips verification entirely.
Both are `onlyRelayer`, so **a single compromised/malicious relayer can post any decrypted result**
(fake auction winner, forged vote tally) — the entire M-of-N threshold KMS we built is bypassable.

**Fix:** require `signatures.length >= kmsVerifier.threshold()` and always verify; delete
`fulfillPublicDecryptionNoVerify` (or gate it behind a governance flag, off by default).

### C2 — `FhishACL.allow` is unauthenticated
```solidity
function allow(bytes32 handle, address account) external { persistentAllowed[handle][account] = true; }
```
Anyone can grant themselves ACL access to **any** handle, then call `/reencrypt` and read another user's
value. This **defeats the ACL and the sealoutput confidentiality** the protocol is built on. (The
sealoutput demo's "Mallory refused" only holds because Mallory didn't call `allow` first.)

**Fix:** permission `allow`/`allowTransient`/`allowForDecryption` to the coprocessor executor and/or a
registry of authorised app contracts (Zama's ACL is permissioned — only the FHE executor writes it).

### C3 — `ConfidentialFAsset.fulfillWithdraw` is unauthenticated
```solidity
function fulfillWithdraw(address account, uint256 amount, bytes32 newBalanceHandle) external {
    require(amount <= totalEscrowed); totalEscrowed -= amount; ...; fxrp.transfer(account, amount);
}
```
No caller check, no proof the `amount` corresponds to a real decrypted balance. **Anyone drains the whole
FXRP escrow** to any address.

**Fix:** `onlyGateway` (callback from a verified decryption) + bind `amount` to the decrypted balance of
`account` from a `requestDecryption` this contract initiated.

## High

- **H1 — `recomputeBalances` unauthenticated** (token + FAsset): anyone overwrites any account's encrypted
  balance handle → forge/grief balances. **Fix:** restrict to the attested relayer/coprocessor.
- **H2 — Input proofs pass-through:** `verifyCiphertext` ignores `inputProof`; a client can submit
  malformed ciphertext or claim a handle it didn't create. **Fix:** ZKPoK (roadmap) or at minimum a
  well-formedness check + a submitter-binding signature over `(handle, contract, sender, chainId)`.
- **H3 — Apps wired to the single-signer gateway:** voting/auction point at `FhishGateway` (single
  `gatewaySigner`), so the threshold committee is not in their trust path. **Fix:** redeploy apps against
  the threshold gateway (and fix C1 there).

## Medium

- **M1 — Replayable re-encryption permit:** `reencryptMessage(handle, key)` lacks nonce/expiry/chainId/
  relayer binding. **Fix:** EIP-712 typed permit with `nonce`, `deadline`, `chainId`, `verifyingContract`.
- **M2 — Non-standard ECIES:** key = `sha256(sharedSecret)` with no HKDF/salt/domain separation. **Fix:**
  HKDF-SHA256 with an info label; prefer a vetted library (`@noble/ciphers` ECIES / NaCl box).
- **M3 — Reentrancy surface:** the gateway does `req.caller.call{value}` after setting `decryptionDone`
  (good — no re-fulfil), but into an arbitrary contract. Keep the state-before-call ordering; consider a
  `nonReentrant` guard and stricter callback allow-listing.

## Low / Info

- **L1** rate-limit + auth the relayer HTTP endpoints. **L2** the FHE secret key is a single-host secret
  (roadmap: MPC key-sharing). **L3** serve the relayer over TLS in prod; set a real WalletConnect id.
- **Info:** `submitCiphertext` stores full ciphertext on-chain (unbounded gas) — unused by apps; remove
  or cap. `recomputeBalances`/`fulfillWithdraw` are commented "kept open for the demo" — must be closed
  before any real deployment.

## Overall

The **cryptographic core is sound** (real tfhe, deterministic handles, threshold-signature *primitive*,
ECIES seal), but the **authorization layer is not**: unauthenticated `allow`, optional decryption
signatures, and open asset/balance writebacks mean the confidentiality and integrity guarantees do **not
hold against a motivated attacker** today. These are demo-stage gaps, and all Critical/High items have
concrete, small fixes. **Fix C1–C3 + H1 before any value-bearing deployment.**
