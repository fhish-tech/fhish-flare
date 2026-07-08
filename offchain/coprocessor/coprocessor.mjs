// The fhish coprocessor — single source of truth for materializing the on-chain op graph into real
// Zama tfhe ciphertexts. Consolidates logic that was copy-pasted across e2e scripts + the daemon.
//
// Supports: euint32 + euint64 + ebool; TrivialEncrypt, VerifyInput, Cast, Rand (verifiable randomness),
// FheSelect (ebool), and FheOp (add/sub/mul [+scalar], and/or/xor/not, shl/shr, min/max, eq/ne/lt/le/gt/ge).
// Type byte in each handle's last byte selects the class: 0=ebool, 3=euint32, 4=euint64.
// Dependency-free: pass a `keccak256` fn (e.g. ethers.keccak256) via opts for randomness materialization.

export const TYPE = { EBOOL: 0, EUINT8: 1, EUINT16: 2, EUINT32: 3, EUINT64: 4 };
export const OP = {
  ADD: 1, SUB: 2, MUL: 3, AND: 6, OR: 7, XOR: 8, SHL: 9, SHR: 10,
  EQ: 13, NE: 14, GE: 15, GT: 16, LE: 17, LT: 18, MIN: 19, MAX: 20, NOT: 22,
};

// ABI fragments every fhish app/executor emits — reuse for log parsing.
export const COPROCESSOR_EVENTS = [
  "event TrivialEncrypt(bytes32 result, uint256 value, uint8 toType)",
  "event VerifyInput(bytes32 result, bytes32 inputHandle, address caller, uint8 inputType)",
  "event Cast(bytes32 result, bytes32 ct, uint8 toType)",
  "event Rand(bytes32 result, uint256 upperBound, bytes32 seed, uint8 randType)",
  "event FheOp(uint8 indexed op, bytes32 result, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, uint8 resultType)",
  "event FheSelect(bytes32 result, bytes32 control, bytes32 ifTrue, bytes32 ifFalse, uint8 resultType)",
];

export function createCoprocessor(wasm, clientKey, opts = {}) {
  const store = opts.store || new Map();
  const keccak256 = opts.keccak256 || (() => { throw new Error("coprocessor: pass opts.keccak256 for randomness"); });
  const k = (h) => h.toLowerCase();
  const typeByte = (h) => Number(BigInt(h) & 0xffn);
  const boolCls = () => wasm.FhisBool;
  const uintCls = (t) => (t === TYPE.EUINT64 ? wasm.FhisUint64 : wasm.FhisUint32);
  const clsFor = (t) => (t === TYPE.EBOOL ? boolCls() : uintCls(t));
  const num = (t, v) => (t === TYPE.EUINT64 ? BigInt(v) : Number(v));

  function applyBin(op, a, b, scalar) {
    switch (op) {
      case OP.ADD: return scalar != null ? a.add_scalar(scalar) : a.add(b);
      case OP.SUB: return scalar != null ? a.sub_scalar(scalar) : a.sub(b);
      case OP.MUL: return scalar != null ? a.mul_scalar(scalar) : a.mul(b);
      case OP.AND: return a.bitand(b);
      case OP.OR:  return a.bitor(b);
      case OP.XOR: return a.bitxor(b);
      case OP.SHL: return a.left_shift(Number(scalar ?? 1));
      case OP.SHR: return a.right_shift(Number(scalar ?? 1));
      case OP.NOT: return a.bitnot();
      case OP.EQ:  return a.eq(b);
      case OP.NE:  return a.ne(b);
      case OP.GE:  return a.ge(b);
      case OP.GT:  return a.gt(b);
      case OP.LE:  return a.le(b);
      case OP.LT:  return a.lt(b);
      case OP.MIN: return a.min(b);
      case OP.MAX: return a.max(b);
      default: throw new Error(`coprocessor: unsupported opcode ${op}`);
    }
  }

  const api = {
    store,
    setCiphertext(handle, bytes) { store.set(k(handle), bytes); },
    has(handle) { return store.has(k(handle)); },
    /// Encrypt a private input with the FHE public key (as a client would).
    encryptInput(value, publicKey, t = TYPE.EUINT32) {
      return uintCls(t).encrypt_with_public_key(num(t, value), publicKey).serialize();
    },
    /// Materialize one parsed coprocessor event into the ciphertext store. Returns true if handled.
    materialize(p) {
      const a = p.args;
      switch (p.name) {
        case "TrivialEncrypt": {
          const t = Number(a.toType);
          store.set(k(a.result), uintCls(t).encrypt_trivial(num(t, a.value)).serialize());
          return true;
        }
        case "VerifyInput":
          if (store.has(k(a.inputHandle))) store.set(k(a.result), store.get(k(a.inputHandle)));
          return true;
        case "Cast": // same ciphertext, re-tagged type (euint32<->euint64 cast not size-changing here)
          if (store.has(k(a.ct))) store.set(k(a.result), store.get(k(a.ct)));
          return true;
        case "Rand": {
          // VERIFIABLE randomness: value = keccak(seed) mod bound. `seed` is on-chain (blockhash, or
          // Flare's RandomNumberV2 via fheRandBoundedSeeded) so anyone can recompute + audit it.
          const t = Number(a.randType);
          const bound = BigInt(a.upperBound) === 0n ? (t === TYPE.EUINT64 ? 1n << 64n : 1n << 32n) : BigInt(a.upperBound);
          const val = BigInt(keccak256(a.seed)) % bound;
          store.set(k(a.result), uintCls(t).encrypt_trivial(num(t, val)).serialize());
          return true;
        }
        case "FheSelect": {
          // Only ebool operands are materializable with this wasm build (FhisBool.mux). euint `select`
          // needs a cmux-capable wasm build — roadmap. The on-chain handle is still correct.
          if (typeByte(a.ifTrue) !== TYPE.EBOOL)
            throw new Error("coprocessor: euint select needs a cmux wasm build (roadmap)");
          const ctrl = boolCls().deserialize(store.get(k(a.control)));
          const out = ctrl.mux(boolCls().deserialize(store.get(k(a.ifTrue))), boolCls().deserialize(store.get(k(a.ifFalse))));
          store.set(k(a.result), out.serialize());
          return true;
        }
        case "FheOp": {
          const op = Number(a.op);
          const lt = typeByte(a.lhs);
          const C = uintCls(lt);
          const lhs = C.deserialize(store.get(k(a.lhs)));
          const isScalar = a.scalarByte && a.scalarByte !== "0x00";
          let out;
          if (isScalar) out = applyBin(op, lhs, null, num(lt, BigInt(a.rhs)));
          else out = applyBin(op, lhs, store.has(k(a.rhs)) ? C.deserialize(store.get(k(a.rhs))) : lhs, null);
          store.set(k(a.result), out.serialize());
          return true;
        }
        default: return false;
      }
    },
    /// Materialize every coprocessor event in a tx receipt (given an ethers Interface).
    materializeReceipt(receipt, iface) {
      for (const log of receipt.logs) {
        let p; try { p = iface.parseLog(log); } catch { continue; }
        if (p) try { api.materialize(p); } catch { /* skip unmaterializable (e.g. euint select) */ }
      }
    },
    /// Decrypt a handle using its type byte (boolean | number | bigint).
    decrypt(handle) {
      const t = typeByte(handle);
      return clsFor(t).deserialize(store.get(k(handle))).decrypt(clientKey);
    },
  };
  return api;
}
