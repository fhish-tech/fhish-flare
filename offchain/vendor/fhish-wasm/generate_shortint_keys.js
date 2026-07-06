const wasm = require('./pkg-node/fhish_wasm.js');

async function generateKeys() {
    console.log("Generating shortint keys...\n");
    
    // Create config with COMPACT_PK params
    console.log("Creating config with COMPACT_PK params...");
    const config = wasm.FhisShortintConfig.compact_pk();
    console.log("Config created");
    
    // Create client key
    console.log("Creating client key...");
    const clientKey = wasm.FhisShortintClientKey.new(config);
    console.log("ClientKey created, __wbg_ptr:", clientKey.__wbg_ptr);
    
    // Create compact public key
    console.log("Creating CompactPublicKey...");
    const publicKey = wasm.FhisShortintCompactPublicKey.new(clientKey);
    console.log("PublicKey created");
    
    // Create server key
    console.log("Creating ServerKey...");
    const serverKey = wasm.FhisShortintServerKey.new(clientKey);
    console.log("ServerKey created");
    
    // Serialize
    console.log("\nSerializing keys...");
    const clientKeyBytes = clientKey.serialize();
    const publicKeyBytes = publicKey.serialize();
    const serverKeyBytes = serverKey.serialize();
    
    console.log("Key sizes:");
    console.log("  Client key:", clientKeyBytes.length, "bytes");
    console.log("  Public key:", publicKeyBytes.length, "bytes");
    console.log("  Server key:", serverKeyBytes.length, "bytes");
    
    // Save to files
    const fs = require('fs');
    const outputDir = process.argv[2] || './shortint_keys';
    fs.mkdirSync(outputDir, { recursive: true });
    
    fs.writeFileSync(`${outputDir}/shortint_client_key.bin`, Buffer.from(clientKeyBytes));
    fs.writeFileSync(`${outputDir}/shortint_public_key.bin`, Buffer.from(publicKeyBytes));
    fs.writeFileSync(`${outputDir}/shortint_server_key.bin`, Buffer.from(serverKeyBytes));
    fs.writeFileSync(`${outputDir}/key_metadata.json`, JSON.stringify({
        type: "FhisShortint",
        parameters: "COMPACT_PK",
        created: new Date().toISOString()
    }));
    
    console.log("\nKeys saved to:", outputDir);
    console.log("Next steps:");
    console.log("1. Copy keys to gateway: cp -r", outputDir, "../fhish-gateway/keys-shortint");
    console.log("2. Update gateway to use shortint keys");
}

generateKeys().catch(console.error);
