const wasm = require('./pkg-node/fhish_wasm.js');

// Check what the wasm function returns
const wasmExports = wasm;

console.log("Checking WASM function signatures...");

// We can't directly call the WASM function without proper setup, but let's check the class
const FhisShortintConfig = wasm.FhisShortintConfig;
const FhisShortintClientKey = wasm.FhisShortintClientKey;

// Create a config
const config = new FhisShortintConfig();
console.log("config.__wbg_ptr:", config.__wbg_ptr);

// Try calling the static new directly
console.log("\nCalling FhisShortintClientKey.new...");
try {
    const clientKey = FhisShortintClientKey.new(config);
    console.log("clientKey:", clientKey);
    console.log("clientKey.__wbg_ptr:", clientKey.__wbg_ptr);
} catch (e) {
    console.log("Error:", e.message);
    console.log("Error name:", e.name);
}

// Try using constructor
console.log("\nUsing new FhisShortintClientKey(config)...");
try {
    const clientKey2 = new FhisShortintClientKey(config);
    console.log("clientKey2:", clientKey2);
    console.log("clientKey2.__wbg_ptr:", clientKey2.__wbg_ptr);
} catch (e) {
    console.log("Error:", e.message);
    console.log("Error name:", e.name);
}
