// Shared FHE keyset for the fhish confidential protocol (like Zama's network keys).
//   compactPublicKey  -> clients ENCRYPT inputs with this (public)
//   serverKey         -> the coprocessor COMPUTES homomorphically with this (public)
//   clientKey         -> the gateway/KMS DECRYPTS with this (SECRET — the trust root)
// Generated once, persisted to .secrets/fhe-keys/. In production the clientKey would be
// threshold-shared across an MPC KMS (roadmap); here a single trusted gateway holds it.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const KEYS_DIR = path.join(ROOT, ".secrets/fhe-keys");

export async function loadOrGenerateKeys(wasm) {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  const p = (n) => path.join(KEYS_DIR, n);
  let clientKey, publicKey, serverKey;

  if (fs.existsSync(p("client.bin"))) {
    clientKey = wasm.FhisClientKey.deserialize(fs.readFileSync(p("client.bin")));
    publicKey = wasm.FhisCompactPublicKey.deserialize(fs.readFileSync(p("public.bin")));
    serverKey = wasm.FhisServerKey.deserialize(fs.readFileSync(p("server.bin")));
  } else {
    const config = new wasm.FhisConfig();
    clientKey = wasm.FhisClientKey.generate(config);
    publicKey = wasm.FhisCompactPublicKey.new(clientKey);
    serverKey = wasm.FhisServerKey.new(clientKey);
    fs.writeFileSync(p("client.bin"), clientKey.serialize());
    fs.writeFileSync(p("public.bin"), publicKey.serialize());
    fs.writeFileSync(p("server.bin"), serverKey.serialize());
  }
  wasm.set_server_key(serverKey);
  return { clientKey, publicKey, serverKey };
}

export { KEYS_DIR };
