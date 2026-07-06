const wasm = require('./pkg-node/fhish_wasm.js');

async function testParams() {
    console.log("Testing different shortint parameters...\n");
    
    const { FhisShortintConfig, FhisShortintClientKey, FhisShortintCompactPublicKey } = wasm;
    
    // Test different params
    const params = [
        { name: 'PARAM_MESSAGE_1_CARRY_1_COMPACT_PK_KS_PBS', fn: () => FhisShortintConfig.compact_pk() },
    ];
    
    for (const p of params) {
        console.log(`\n=== ${p.name} ===`);
        try {
            const config = p.fn();
            console.log("Config created");
            
            const clientKey = FhisShortintClientKey.new(config);
            console.log("ClientKey created");
            
            const publicKey = FhisShortintCompactPublicKey.new(clientKey);
            console.log("PublicKey created");
            
            // Encrypt
            const ct = publicKey.encrypt(1);
            console.log("Encrypted, size_bytes:", ct.size_bytes());
            
            // Expand
            const expanded = ct.expand();
            const ctBytes = expanded.serialize();
            console.log("Expanded ciphertext size:", ctBytes.length, "bytes", `(${(ctBytes.length/1024).toFixed(1)} KB)`);
            
            // Deserialize and check size
            const deserialized = expanded.deserialize(ctBytes);
            console.log("Deserialized OK");
            
        } catch (e) {
            console.log("Error:", e.message);
        }
    }
    
    console.log("\n=== Summary ===");
    console.log("To get smaller ciphertexts:");
    console.log("1. Use smaller LWE dimension parameters");
    console.log("2. Use KS_PBS order (smaller ciphertexts than PBS_KS)");
    console.log("3. For 2-4KB: need custom small params with LWE dim ~250-500");
}

testParams().catch(console.error);
