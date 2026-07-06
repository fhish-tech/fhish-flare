# fhish-flare examples — confidential dApps on Coston2

Live, on-chain examples of the fhish FHE + Flare Confidential Compute stack. Tx proofs in
[`proofs.json`](proofs.json).

## Real-tfhe end-to-end (the headline)

```bash
cd ../offchain/gateway && node --import ./src/polyfill.mjs e2e-coston2.mjs
```
Proves: real Zama tfhe `enc(3)+enc(5)=8` / `min=3` / `3<5`, a 32-byte handle written on Coston2, and the
decrypted result verified on-chain by the **attestation-bound** `FhishKMSVerifier`.

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
