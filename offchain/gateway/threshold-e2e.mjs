// Proves the M-of-N threshold KMS on Coston2: a real FHE decryption is only accepted on-chain when
// >= 2 of 3 committee operators sign. One signature is rejected; two succeed.
// Run from offchain/gateway:  node --import ./src/polyfill.mjs threshold-e2e.mjs
import { ethers } from "ethers";
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const dep = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/coston2.json"), "utf8"));
const ops = JSON.parse(fs.readFileSync(path.join(ROOT, ".secrets/operators.json"), "utf8"));
const PK = fs.readFileSync(path.join(ROOT, "contracts/.env"), "utf8").match(/PRIVATE_KEY=(0x[0-9a-fA-F]+)/)[1];
const abi = new ethers.AbiCoder();
const T = dep.threshold;

const CONSUMER = ["function reveal(bytes32) returns (uint256)","function lastDecryptionId() view returns (uint256)","function revealedValue() view returns (uint32)","function revealed() view returns (bool)"];
const GATEWAY = ["function fulfillPublicDecryption(uint256 id, bytes result, bytes[] sigs)","function getHandles(uint256) view returns (bytes32[])"];

async function main() {
  const wasm = await import("fhish-wasm"); wasm.init_panic_hook?.();
  const config = new wasm.FhisConfig();
  const clientKey = wasm.FhisClientKey.generate(config);
  wasm.set_server_key(wasm.FhisServerKey.new(clientKey));
  const encSum = wasm.FhisUint32.encrypt(3, clientKey).add(wasm.FhisUint32.encrypt(5, clientKey));
  const plain = encSum.decrypt(clientKey); // 8

  const provider = new ethers.JsonRpcProvider(dep.rpc, dep.chainId);
  const relayer = new ethers.Wallet(PK, provider);
  const operators = ops.map((o) => new ethers.Wallet(o.privateKey));
  const consumer = new ethers.Contract(T.DecryptionConsumer, CONSUMER, relayer);
  const gateway = new ethers.Contract(T.FhishGateway, GATEWAY, relayer);

  const handle = ethers.keccak256(ethers.hexlify(encSum.serialize()));
  await (await consumer.reveal(handle)).wait();
  const id = await consumer.lastDecryptionId();
  const handles = await gateway.getHandles(id);
  const result = abi.encode(["uint32"], [plain]);
  const digest = ethers.solidityPackedKeccak256(["bytes32[]", "bytes"], [handles, result]);
  const sig = (w) => w.signMessage(ethers.getBytes(digest));

  console.log(`committee: ${T.threshold}-of-${T.operators.length}; decryption result = ${plain}`);

  // Attempt with ONE signature -> must be rejected by the gateway (below threshold).
  try {
    await (await gateway.fulfillPublicDecryption(id, result, [await sig(operators[0])])).wait();
    console.log("❌ 1 signature was accepted (should NOT happen)");
  } catch {
    console.log("✅ 1 signature REJECTED on-chain (below threshold)");
  }

  // Attempt with TWO operator signatures -> accepted.
  await (await gateway.fulfillPublicDecryption(id, result, [await sig(operators[0]), await sig(operators[1])])).wait();
  const val = await consumer.revealedValue();
  console.log(`✅ 2-of-3 signatures ACCEPTED -> consumer.revealedValue = ${val} (revealed=${await consumer.revealed()})`);
  if (Number(val) !== 8) throw new Error("threshold fulfill failed");
  console.log(`\n✅ Threshold KMS on Flare: no single operator can authorize a decryption; ${T.threshold} must agree.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
