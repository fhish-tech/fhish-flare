import { ethers } from "ethers";

export function bytesToBigInt(bytes: Uint8Array): bigint {
  return BigInt(ethers.hexlify(bytes));
}

export function bigIntToBytes(value: bigint): Uint8Array {
  let hex = value.toString(16);
  if (hex.length % 2 !== 0) hex = "0" + hex;
  return ethers.getBytes("0x" + hex);
}

export function toHexString(bytes: Uint8Array): string {
  return ethers.hexlify(bytes);
}

export function fromHexString(hex: string): Uint8Array {
  return ethers.getBytes(hex);
}
