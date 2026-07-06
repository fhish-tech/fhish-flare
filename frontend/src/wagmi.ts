import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

// Flare Coston2 testnet as a viem/wagmi chain.
export const coston2 = defineChain({
  id: 114,
  name: "Flare Coston2",
  nativeCurrency: { name: "Coston2 Flare", symbol: "C2FLR", decimals: 18 },
  rpcUrls: { default: { http: ["https://coston2-api.flare.network/ext/C/rpc"] } },
  blockExplorers: { default: { name: "Coston2 Explorer", url: "https://coston2-explorer.flare.network" } },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: "fhish — Confidential Voting on Flare",
  // Get a free projectId at https://cloud.walletconnect.com and put it in .env as VITE_WC_PROJECT_ID
  projectId: import.meta.env.VITE_WC_PROJECT_ID || "YOUR_WALLETCONNECT_PROJECT_ID",
  chains: [coston2],
  ssr: false,
});

// Deployed on Coston2 (see deployments/coston2.json). Override via .env if you redeploy.
export const VOTING_ADDRESS = (import.meta.env.VITE_VOTING_ADDRESS ||
  "0xce1080027BCa9718Ab7B002049dE64241E6eE8eE") as `0x${string}`;
export const RELAYER_URL = import.meta.env.VITE_RELAYER_URL || "http://localhost:8090";
