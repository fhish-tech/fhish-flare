# fhish Confidential Voting — frontend (RainbowKit + wagmi)

A minimal dApp: connect a wallet with **RainbowKit**, cast a **confidential vote** on Flare Coston2.
Your ballot is FHE-encrypted; only the final aggregate tally is ever revealed.

## Run

```bash
# 1. Start the relayer (holds FHE keys, encrypts ballots, decrypts tallies). From offchain/gateway:
node --import ./src/polyfill.mjs relayer-daemon.mjs      # serves :8090

# 2. Start the frontend:
cd frontend
cp .env.example .env         # add a WalletConnect projectId (free: cloud.walletconnect.com)
npm install
npm run dev                  # http://localhost:5173
```

## Flow

1. Connect wallet (RainbowKit) → network **Flare Coston2** (chainId 114). Get C2FLR from faucet.flare.network.
2. Pick a candidate → **Vote confidentially**:
   - the relayer encrypts a one-hot ballot with the FHE public key and returns on-chain handles,
   - your wallet signs the `vote(handles, proof)` transaction — only ciphertext handles touch the chain.
3. Admin clicks **Close** → the relayer decrypts and posts the aggregate tallies.
4. Everyone sees the totals; **no individual ballot is ever revealed**.

## Where is the relayer?

Off-chain — the `relayer-daemon.mjs` process (your laptop for dev, a small VM/container in prod). It holds
the FHE keys, watches Coston2 for the symbolic op graph, materializes the real ciphertexts, and fulfills
decryption. It is the trusted component (single gateway today; threshold KMS is roadmap).

## Honest note

For this demo the **relayer encrypts** the ballot (it holds the FHE key and can decrypt anyway, so this
matches the single-gateway trust model — your vote is hidden from the chain and from other voters). A
production build would encrypt **client-side in the browser** with a fhish-wasm web build so the relayer
never sees the plaintext choice. That web build is roadmap.
