import { ethers } from "ethers";
import { FhishConfig, FhishPermit } from "./types";

const DEFAULT_GATEWAY_URL = "http://localhost:8080";

function log(prefix: string, ...args: any[]) {
  console.log(`[FhishSDK] ${prefix}`, ...args);
}

let fhisLoaded: any = null;
let initPromise: Promise<any> | null = null;

export async function initFhis(gatewayUrl: string, wasmUrl?: string): Promise<any> {
  if (fhisLoaded) {
    log("initFhis", "fhish-wasm already loaded, returning cached");
    return fhisLoaded;
  }
  if (initPromise) {
    log("initFhis", "fhish-wasm loading in progress, awaiting...");
    return initPromise;
  }

  initPromise = (async () => {
    log("initFhis", "Loading fhish-wasm module via dynamic import...");
    const fhis: any = await import("fhish-wasm");
    log("initFhis", "fhish-wasm loaded, types:", Object.keys(fhis).filter(k => k.startsWith("Fhis")).join(", "));

    const resolvedWasmUrl = wasmUrl ?? (
      typeof window !== "undefined"
        ? `${window.location.origin}/fhish_wasm_bg.wasm`
        : `${gatewayUrl}/fhish_wasm_bg.wasm`
    );
    log("initFhis", "WASM URL resolved to:", resolvedWasmUrl);

    log("initFhis", "[OK] fhish-wasm ready");
    fhisLoaded = fhis;
    return fhis;
  })();

  return initPromise;
}

export interface EncryptedInputBuilder {
  add(value: number | bigint | boolean): EncryptedInputBuilder;
  add32(value: number | bigint): EncryptedInputBuilder;
  addBool(value: boolean): EncryptedInputBuilder;
  addShortint(value: number): EncryptedInputBuilder;
  encrypt(): Promise<{ handles: string[]; ciphertexts: Uint8Array[] }>;
  submitToGateway(signer: ethers.Signer, gatewayAddress: string): Promise<{ handles: string[] }>;
}

export class FhishClient {
  private config: FhishConfig;
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private publicKey: any = null;
  private clientKey: any = null;
  private gatewayUrl: string;
  private initialized: boolean = false;

  constructor(
    config: Partial<FhishConfig> & { gatewayUrl?: string },
    provider: ethers.Provider,
    signer?: ethers.Signer
  ) {
    log("Constructor", "Creating FhishClient");
    log("Constructor", "Config:", JSON.stringify({
      gatewayAddress: config.gatewayAddress ?? "(none)",
      chainId: config.chainId,
    }));
    log("Constructor", "gatewayUrl:", config.gatewayUrl ?? DEFAULT_GATEWAY_URL);
    log("Constructor", "signer:", signer ? "provided" : "none");

    this.config = {
      gatewayAddress: config.gatewayAddress ?? "",
      gatewayContractAddress: (config as any).gatewayContractAddress ?? "",
      networkPublicKey: config.networkPublicKey ?? "",
      chainId: config.chainId ?? 11155111,
      kmsAddress: config.kmsAddress ?? "",
      aclAddress: config.aclAddress ?? "",
    };
    this.provider = provider;
    this.signer = signer;
    this.gatewayUrl = config.gatewayUrl ?? DEFAULT_GATEWAY_URL;
  }

  async init(): Promise<void> {
    if (this.initialized) {
      log("init", "Already initialized, skipping");
      return;
    }

    log("init", "Starting initialization...");
    log("init", "Fetching public key from gateway:", `${this.gatewayUrl}/get-public-key`);

    const fhis = await initFhis(this.gatewayUrl);
    log("init", "fhish-wasm ready, fetching public key...");

    const publicKeyHex = await this.fetchPublicKey();
    log("init", "Public key received:", `${publicKeyHex.slice(0, 20)}... (${publicKeyHex.length} chars)`);

    const publicKeyBytes = this.hexToBytes(publicKeyHex);
    log("init", "Deserializing public key from", publicKeyBytes.length, "bytes...");
    this.publicKey = fhis.FhisCompactPublicKey.deserialize(publicKeyBytes);
    log("init", "[OK] Public key deserialized successfully");

    this.initialized = true;
    log("init", "★ FhishClient fully initialized with FhisUint32");
  }

  async initWithClientKey(clientKeyHex: string): Promise<void> {
    if (this.initialized) {
      log("initWithClientKey", "Already initialized, skipping");
      return;
    }

    log("initWithClientKey", "Initializing with client key...");
    const fhis = await initFhis(this.gatewayUrl);

    const clientKeyBytes = this.hexToBytes(clientKeyHex);
    log("initWithClientKey", "Deserializing client key from", clientKeyBytes.length, "bytes...");
    this.clientKey = fhis.FhisClientKey.deserialize(clientKeyBytes);
    log("initWithClientKey", "[OK] Client key deserialized successfully");

    this.initialized = true;
    log("initWithClientKey", "★ FhishClient initialized with client key");
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getPublicKeyHex(): string {
    if (!this.publicKey) throw new Error("Client not initialized");
    return this.bytesToHex(this.publicKey.serialize());
  }

  getClientKeyHex(): string {
    if (!this.clientKey) throw new Error("Client key not available");
    return this.bytesToHex(this.clientKey.serialize());
  }

  decrypt32(ciphertext: Uint8Array): number {
    if (!this.clientKey) throw new Error("Client key not available — call initWithClientKey()");
    return Number(fhisLoaded.FhisUint32.deserialize(ciphertext).decrypt(this.clientKey));
  }

  decryptBool(ciphertext: Uint8Array): boolean {
    if (!this.clientKey) throw new Error("Client key not available — call initWithClientKey()");
    return fhisLoaded.FhisBool.deserialize(ciphertext).decrypt(this.clientKey);
  }

  createEncryptedInput(_contractAddress: string, _userAddress: string): EncryptedInputBuilder {
    log("createEncryptedInput", `contract=${_contractAddress}, user=${_userAddress}`);

    if (!this.initialized || !this.publicKey || !fhisLoaded) {
      throw new Error("FhishClient not initialized — call init() first");
    }

    const fhis = fhisLoaded;
    const publicKey = this.publicKey;
    const gatewayUrl = this.gatewayUrl;
    const bytesToHex = (bytes: Uint8Array): string => this.bytesToHex(bytes);

    const items: Array<{
      type: "uint32" | "bool";
      value: number | boolean;
    }> = [];

    const state: {
      ciphertexts: Uint8Array[];
      httpHandles: string[];
    } = {
      ciphertexts: [],
      httpHandles: [],
    };

    return {
      add(value: number | bigint | boolean): EncryptedInputBuilder {
        items.push({ type: "uint32", value: Number(value) });
        return this;
      },
      add32(value: number | bigint): EncryptedInputBuilder {
        items.push({ type: "uint32", value: Number(value) });
        return this;
      },
      addBool(value: boolean): EncryptedInputBuilder {
        items.push({ type: "bool", value });
        return this;
      },
      addShortint(_value: number): EncryptedInputBuilder {
        items.push({ type: "uint32", value: _value & 0x3 });
        return this;
      },
      async encrypt(): Promise<{ handles: string[]; ciphertexts: Uint8Array[] }> {
        log("EncryptedInput.encrypt", "Encrypting", items.length, "items");

        state.ciphertexts = [];
        state.httpHandles = [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          log(`EncryptedInput.encrypt[${i}]`, `Type=${item.type}, Value=${item.value}`);

          let ct: Uint8Array;
          try {
            if (item.type === "uint32") {
              const encrypted = fhis.FhisUint32.encrypt_with_public_key(
                Number(item.value),
                publicKey
              );
              ct = encrypted.serialize();
            } else if (item.type === "bool") {
              const encrypted = fhis.FhisBool.encrypt_with_public_key(
                Boolean(item.value),
                publicKey
              );
              ct = encrypted.serialize();
            } else {
              throw new Error(`Unknown type: ${item.type}`);
            }
            log(`EncryptedInput.encrypt[${i}]`, "[OK] Ciphertext:", ct.length, "bytes");
            state.ciphertexts.push(ct);
          } catch (err: any) {
            log(`EncryptedInput.encrypt[${i}]`, "[ERROR] Encryption failed:", err.message);
            throw new Error(`Encryption failed: ${err.message}`);
          }
        }

        for (let i = 0; i < state.ciphertexts.length; i++) {
          const ct = state.ciphertexts[i];
          const hex = bytesToHex(ct);
          log(`EncryptedInput.encrypt[${i}]`, "Submitting to gateway:", `${hex.slice(0, 40)}...`);

          try {
            const res = await fetch(`${gatewayUrl}/ciphertext`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ciphertext: hex }),
            });
            if (!res.ok) {
              const text = await res.text();
              throw new Error(`/ciphertext POST failed: ${res.status} ${text}`);
            }
            const data = await res.json() as { handle: string };
            log(`EncryptedInput.encrypt[${i}]`, "[OK] Gateway stored, handle:", data.handle);
            state.httpHandles.push(data.handle);
          } catch (err: any) {
            log(`EncryptedInput.encrypt[${i}]`, "[ERROR] Gateway failed:", err.message);
            throw err;
          }
        }

        log("EncryptedInput.encrypt", "★ Encryption complete");
        return { handles: state.httpHandles, ciphertexts: state.ciphertexts };
      },
      async submitToGateway(_signer: ethers.Signer, _gatewayContractAddress: string): Promise<{ handles: string[] }> {
        return { handles: state.httpHandles };
      },
    };
  }

  async signPermit(contractAddress: string): Promise<FhishPermit> {
    log("signPermit", "Signing permit for contract:", contractAddress);
    if (!this.signer) throw new Error("Signer required for permit signing");
    if (!this.publicKey) throw new Error("Client not initialized");

    const publicKeyHex = this.getPublicKeyHex();

    const domain = {
      name: "Fhish",
      version: "1",
      chainId: this.config.chainId,
      verifyingContract: contractAddress,
    };

    const types = {
      FhishPermit: [
        { name: "publicKey", type: "bytes" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const message = {
      publicKey: publicKeyHex,
      nonce: 0,
      deadline,
    };

    const signature = await this.signer.signTypedData(domain, types, message);
    log("signPermit", "[OK] Signature obtained");

    return {
      publicKey: publicKeyHex,
      signature,
      privateKey: "",
    };
  }

  async encryptVote(support: boolean): Promise<Uint8Array> {
    log("encryptVote", "Encrypting vote:", support ? "YES (1)" : "NO (0)");
    
    if (!this.initialized || !this.publicKey || !fhisLoaded) {
      throw new Error("FhishClient not initialized — call init() first");
    }

    const voteValue = support ? 1 : 0;
    const encrypted = fhisLoaded.FhisUint32.encrypt_with_public_key(voteValue, this.publicKey);
    const ct = encrypted.serialize();
    
    log("encryptVote", "[OK] Vote encrypted:", ct.length, "bytes");
    return ct;
  }

  private async fetchPublicKey(): Promise<string> {
    const url = `${this.gatewayUrl}/get-public-key`;
    log("fetchPublicKey", "Fetching from:", url);
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gateway /get-public-key failed: ${res.status} — ${text}`);
    }
    const data = await res.json() as { publicKey: string; version: string };
    log("fetchPublicKey", "Response: publicKeyLen=", data.publicKey.length);
    return data.publicKey;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  private hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
    }
    return bytes;
  }
}
