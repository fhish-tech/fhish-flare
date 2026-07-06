# Fhish WASM

This package provides the Rust-based WebAssembly (WASM) bindings for the `tfhe-rs` Fully Homomorphic Encryption library. It allows Node.js and browser environments to perform FHE operations such as key generation, encryption, and decryption.

## Architecture

1. **`src/lib.rs`**: Contains the `wasm-bindgen` exports that compile the Rust FHE logic into JavaScript-callable functions.
2. **`src/bin/shortint_keygen.rs`**: A native Rust binary used by the `fhish-cli` to generate the 118MB FHE `SHORTINT` Client and Server evaluation keys.
3. **`src/bin/encrypt_vote.rs`**: A CLI utility to generate deterministic ciphertexts bypassing WASM CSPRNG limitations in strict Node.js environments.

## Usage in Node.js
The package is built using `wasm-pack build --target nodejs --out-dir pkg-node`.
It exposes classes like `FhisShortint` to load keys, encrypt `u32` values, and decrypt ciphertext byte arrays.
