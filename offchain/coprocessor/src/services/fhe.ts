import type { FheType } from '../types/index.js';
import fs from 'fs';
import path from 'path';
import http from 'http';

let tfhe: any = null;
let serverKey: any = null;
let clientKey: any = null;
let initialized = false;
let wasmServer: http.Server | null = null;

export async function initFhe(
  wasmPort: number = 8083,
  keysPath?: string,
  wasmPath?: string
): Promise<void> {
  if (initialized) return;
  
  console.log('[FheService] Starting FHE initialization...');
  
  const keysDir = keysPath || '/Users/jaibajrang/Desktop/Projects/fhish/fhish-gateway/keys';
  const actualWasmPath = wasmPath || path.join(keysDir, 'tfhe_bg.wasm');
  
  console.log('[FheService] Keys directory:', keysDir);
  console.log('[FheService] WASM path:', actualWasmPath);
  
  if (!fs.existsSync(actualWasmPath)) {
    throw new Error(`WASM file not found at ${actualWasmPath}`);
  }
  
  console.log(`[FheService] Starting local WASM server on port ${wasmPort}...`);
  
  wasmServer = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/tfhe_bg.wasm') {
      res.writeHead(200, { 'Content-Type': 'application/wasm' });
      fs.createReadStream(actualWasmPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  
  await new Promise<void>((resolve) => {
    wasmServer!.listen(wasmPort, '127.0.0.1', () => {
      console.log(`[FheService] WASM server listening on http://127.0.0.1:${wasmPort}`);
      resolve();
    });
  });
  
  console.log('[FheService] Loading tfhe module...');
  tfhe = await import('tfhe');
  
  const wasmUrl = `http://127.0.0.1:${wasmPort}/tfhe_bg.wasm`;
  console.log('[FheService] Fetching WASM from:', wasmUrl);
  
  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch WASM: ${response.status}`);
  }
  
  await tfhe.default(response);
  console.log('[FheService] WASM initialized successfully');
  
  const clientKeyPath = path.join(keysDir, 'fhish_client_key.bin');
  
  if (fs.existsSync(clientKeyPath)) {
    console.log('[FheService] Loading existing client key from:', clientKeyPath);
    const clientKeyBuffer = fs.readFileSync(clientKeyPath);
    clientKey = tfhe.TfheClientKey.deserialize(clientKeyBuffer);
    serverKey = tfhe.TfheServerKey.new(clientKey);
    console.log('[FheService] ✓ Client key loaded, server key generated');
  } else {
    throw new Error(`Client key not found at ${clientKeyPath}`);
  }
  
  initialized = true;
  console.log('[FheService] ✓ FHE service fully initialized');
}

export async function shutdown(): Promise<void> {
  if (wasmServer) {
    await new Promise<void>((resolve) => {
      wasmServer!.close(() => resolve());
    });
    console.log('[FheService] WASM server closed');
  }
}

export function isInitialized(): boolean {
  return initialized;
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function deserialize(type: FheType['type'], handle: string): any {
  const bytes = hexToBytes(handle);
  
  switch (type) {
    case 'ebool':
      return tfhe.FheBool.deserialize(bytes);
    case 'euint8':
      return tfhe.FheUint8.deserialize(bytes);
    case 'euint16':
      return tfhe.FheUint16.deserialize(bytes);
    case 'euint32':
      return tfhe.FheUint32.deserialize(bytes);
    case 'euint64':
      return tfhe.FheUint64.deserialize(bytes);
    case 'euint128':
      return tfhe.FheUint128.deserialize(bytes);
    case 'euint256':
      return tfhe.FheUint256.deserialize(bytes);
    default:
      throw new Error(`Unsupported type: ${type}`);
  }
}

function serialize(value: any): string {
  return bytesToHex(value.serialize());
}

export function fheAdd(lhs: string, rhs: string, type: FheType['type']): string {
  if (!initialized) throw new Error('FHE service not initialized');
  
  const lhsCt = deserialize(type, lhs);
  const rhsCt = deserialize(type, rhs);
  
  let result: any;
  switch (type) {
    case 'euint32':
      result = lhsCt.add(rhsCt, serverKey);
      break;
    case 'euint64':
      result = lhsCt.add(rhsCt, serverKey);
      break;
    case 'euint128':
      result = lhsCt.add(rhsCt, serverKey);
      break;
    default:
      throw new Error(`Add not supported for ${type}`);
  }
  
  return serialize(result);
}

export function fheSub(lhs: string, rhs: string, type: FheType['type']): string {
  if (!initialized) throw new Error('FHE service not initialized');
  
  const lhsCt = deserialize(type, lhs);
  const rhsCt = deserialize(type, rhs);
  
  let result: any;
  switch (type) {
    case 'euint32':
      result = lhsCt.sub(rhsCt, serverKey);
      break;
    case 'euint64':
      result = lhsCt.sub(rhsCt, serverKey);
      break;
    default:
      throw new Error(`Sub not supported for ${type}`);
  }
  
  return serialize(result);
}

export function fheMul(lhs: string, rhs: string, type: FheType['type']): string {
  if (!initialized) throw new Error('FHE service not initialized');
  
  const lhsCt = deserialize(type, lhs);
  const rhsCt = deserialize(type, rhs);
  
  let result: any;
  switch (type) {
    case 'euint32':
      result = lhsCt.mul(rhsCt, serverKey);
      break;
    default:
      throw new Error(`Mul not supported for ${type}`);
  }
  
  return serialize(result);
}

export function fheEq(lhs: string, rhs: string, type: FheType['type']): string {
  if (!initialized) throw new Error('FHE service not initialized');
  
  const lhsCt = deserialize(type, lhs);
  const rhsCt = deserialize(type, rhs);
  
  let result: any;
  switch (type) {
    case 'euint32':
      result = lhsCt.eq(rhsCt, serverKey);
      break;
    default:
      throw new Error(`Eq not supported for ${type}`);
  }
  
  return serialize(result);
}

export function fheNe(lhs: string, rhs: string, type: FheType['type']): string {
  if (!initialized) throw new Error('FHE service not initialized');
  
  const lhsCt = deserialize(type, lhs);
  const rhsCt = deserialize(type, rhs);
  
  let result: any;
  switch (type) {
    case 'euint32':
      result = lhsCt.not_eq(rhsCt, serverKey);
      break;
    default:
      throw new Error(`Ne not supported for ${type}`);
  }
  
  return serialize(result);
}

export function fheGt(lhs: string, rhs: string, type: FheType['type']): string {
  if (!initialized) throw new Error('FHE service not initialized');
  
  const lhsCt = deserialize(type, lhs);
  const rhsCt = deserialize(type, rhs);
  
  let result: any;
  switch (type) {
    case 'euint32':
      result = lhsCt.gt(rhsCt, serverKey);
      break;
    default:
      throw new Error(`Gt not supported for ${type}`);
  }
  
  return serialize(result);
}

export function fheGe(lhs: string, rhs: string, type: FheType['type']): string {
  if (!initialized) throw new Error('FHE service not initialized');
  
  const lhsCt = deserialize(type, lhs);
  const rhsCt = deserialize(type, rhs);
  
  let result: any;
  switch (type) {
    case 'euint32':
      result = lhsCt.ge(rhsCt, serverKey);
      break;
    default:
      throw new Error(`Ge not supported for ${type}`);
  }
  
  return serialize(result);
}

export function fheLt(lhs: string, rhs: string, type: FheType['type']): string {
  if (!initialized) throw new Error('FHE service not initialized');
  
  const lhsCt = deserialize(type, lhs);
  const rhsCt = deserialize(type, rhs);
  
  let result: any;
  switch (type) {
    case 'euint32':
      result = lhsCt.lt(rhsCt, serverKey);
      break;
    default:
      throw new Error(`Lt not supported for ${type}`);
  }
  
  return serialize(result);
}

export function fheLe(lhs: string, rhs: string, type: FheType['type']): string {
  if (!initialized) throw new Error('FHE service not initialized');
  
  const lhsCt = deserialize(type, lhs);
  const rhsCt = deserialize(type, rhs);
  
  let result: any;
  switch (type) {
    case 'euint32':
      result = lhsCt.le(rhsCt, serverKey);
      break;
    default:
      throw new Error(`Le not supported for ${type}`);
  }
  
  return serialize(result);
}

export function fheIfThenElse(control: string, ifTrue: string, ifFalse: string, type: FheType['type']): string {
  if (!initialized) throw new Error('FHE service not initialized');
  
  const controlCt = tfhe.FheBool.deserialize(hexToBytes(control));
  const ifTrueCt = deserialize(type, ifTrue);
  const ifFalseCt = deserialize(type, ifFalse);
  
  let result: any;
  switch (type) {
    case 'euint32':
      result = controlCt.if_then_else(ifTrueCt, ifFalseCt, serverKey);
      break;
    default:
      throw new Error(`IfThenElse not supported for ${type}`);
  }
  
  return serialize(result);
}

export function fheNeg(ct: string, type: FheType['type']): string {
  if (!initialized) throw new Error('FHE service not initialized');
  
  const ctDeser = deserialize(type, ct);
  
  let result: any;
  switch (type) {
    case 'euint32':
      result = ctDeser.neg(serverKey);
      break;
    default:
      throw new Error(`Neg not supported for ${type}`);
  }
  
  return serialize(result);
}

export function trivialEncrypt(value: number | string, type: FheType['type']): string {
  if (!initialized) throw new Error('FHE service not initialized');
  
  let result: any;
  const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
  
  switch (type) {
    case 'euint32':
      result = tfhe.FheUint32.encrypt_with_client_key(numValue, clientKey);
      break;
    case 'euint64':
      result = tfhe.FheUint64.encrypt_with_client_key(numValue, clientKey);
      break;
    case 'ebool':
      result = tfhe.FheBool.encrypt_with_client_key(numValue !== 0, clientKey);
      break;
    default:
      throw new Error(`TrivialEncrypt not supported for ${type}`);
  }
  
  return serialize(result);
}
