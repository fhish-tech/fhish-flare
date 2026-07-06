# fhish-flare examples — confidential dApps on Coston2

Live, on-chain examples of the fhish FHE + Flare Confidential Compute stack. Tx proofs in
[`proofs.json`](proofs.json).

## Real-tfhe end-to-end (the headline)

```bash
cd ../offchain/gateway && node --import ./src/polyfill.mjs e2e-coston2.mjs
```
Proves: real Zama tfhe `enc(3)+enc(5)=8` / `min=3` / `3<5`, a 32-byte handle written on Coston2, and the
decrypted result verified on-chain by the **attestation-bound** `FhishKMSVerifier`.

## Fully automated closed loop (the crown jewel)

```bash
cd ../offchain/gateway && node --import ./src/polyfill.mjs closed-loop-coston2.mjs
```
`DecryptionConsumer.reveal(handle)` → `Gateway.requestDecryption` → relayer does the real tfhe decrypt →
the TEE enclave signs → `Gateway.fulfillPublicDecryption` verifies that signature against the
**attestation-bound** KMS → `onDecrypted()` sets `revealedValue = 8`. The value lands on-chain **only
because an attested enclave signed it** — the entire thesis, automated
([fulfillment tx](https://coston2-explorer.flare.network/tx/0x13992b697ee0c8c723418603ba2b47cba0b3911a661093de4b1872d7607cab23)).

## Flagship apps (deployed, exercised)

| Example | What it shows | Flare integration |
|---|---|---|
| **SealedBidAuction** | encrypted bids, off-chain homomorphic argmax, reveal only the winner | **FTSOv2** FLR/USD reserve (live: ~$0.00704) |
| **ConfidentialToken** | fhEVM encrypted ERC-20: mint + confidential transfer over handles | attestation-bound decrypt |
| **ConfidentialFAsset** | private balances over bridged **FXRP** | **FAssets** (`getAssetManagerFXRP`) |
| **PrivateVotingV2** | encrypted votes, homomorphic tally, reveal at close | attestation-bound decrypt |

Regenerate proofs:
```bash
cd ../contracts && npx hardhat run scripts/demo_apps.ts --network coston2
```

## Ported example suite (roadmap)

The 10 `fhish-examples-stellar` scenarios re-target cleanly to Coston2 (same handle model, ethers client).
Tracked in [`../docs/ROADMAP.md`](../docs/ROADMAP.md) M5.
