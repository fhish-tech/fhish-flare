// Runs INSIDE the Google Cloud Confidential Space enclave, alongside the fhish gateway.
//  1. Generates the gateway's decryption-signing key INSIDE the TEE (never leaves).
//  2. Requests a Confidential Space vTPM attestation token whose custom nonce binds to the
//     enclave's signing-key address, so the token cryptographically proves
//     {this enclave image} -> {this signing key}.
//  3. Serves { address, attestationToken } so the off-chain verifier can register it on-chain.
//
// The CS launcher exposes a token endpoint on a unix socket; we ask for a token with our
// nonce (the enclave address) and audience. See:
//   https://cloud.google.com/confidential-computing/confidential-space/docs/reference-tokens
import http from "http";
import fs from "fs";
import crypto from "crypto";
import { ethers } from "ethers";

const CS_SOCKET = "/run/container_launcher/teeserver.sock";
const KEY_PATH = "/enclave/signing-key.json"; // tmpfs inside the enclave

// 1. Enclave-born signing key (persisted only to enclave tmpfs for the container's lifetime).
function loadOrCreateKey() {
  if (fs.existsSync(KEY_PATH)) return new ethers.Wallet(JSON.parse(fs.readFileSync(KEY_PATH)).privateKey);
  const w = ethers.Wallet.createRandom();
  fs.mkdirSync("/enclave", { recursive: true });
  fs.writeFileSync(KEY_PATH, JSON.stringify({ address: w.address, privateKey: w.privateKey }));
  return w;
}
const wallet = loadOrCreateKey();
console.log(`[ATTEST] enclave signing key: ${wallet.address}`);

// 2. Ask the Confidential Space launcher for an OIDC attestation token bound to our nonce.
function fetchCsToken(nonce) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      audience: "fhish-flare-attestation-registry",
      nonces: [nonce],           // binds token -> enclave signing key
      token_type: "OIDC",
    });
    const req = http.request(
      { socketPath: CS_SOCKET, path: "/v1/token", method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
      (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve(d.trim())); }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// The nonce must be >=10 chars; use the checksummed address (42 chars).
const nonce = wallet.address;

let attestationToken = null;
async function refreshToken() {
  try {
    attestationToken = await fetchCsToken(nonce);
    console.log(`[ATTEST] got CS attestation token (${attestationToken.length} chars)`);
  } catch (e) {
    console.error(`[ATTEST] CS token fetch failed (not in Confidential Space?): ${e.message}`);
  }
}
await refreshToken();
setInterval(refreshToken, 30 * 60 * 1000); // CS tokens are short-lived; refresh.

// 3. Expose the enclave identity for the off-chain verifier/registrar.
http
  .createServer((req, res) => {
    if (req.url === "/enclave-identity") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ address: wallet.address, nonce, attestationToken }));
    } else if (req.url === "/health") {
      res.writeHead(200); res.end("ok");
    } else { res.writeHead(404); res.end(); }
  })
  .listen(9000, () => console.log("[ATTEST] identity server on :9000 (/enclave-identity)"));

// The gateway process imports this key to SIGN decryption results (out of band in the same enclave).
export const enclaveSigner = wallet;
