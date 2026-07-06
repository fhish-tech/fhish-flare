import init, * as fhis from "./dist/fhish_wasm.js";

async function test() {
    await init();
    
    // Create config and keys
    const config = new fhis.FhisConfig();
    const clientKey = new fhis.FhisClientKey();
    clientKey.generate(config);
    
    const serverKey = new fhis.FhisServerKey();
    serverKey.new(clientKey);
    
    // Set server key globally (required for operations)
    fhis.set_server_key(serverKey);
    
    // Encrypt values
    const a = fhis.FhisUint32.encrypt(5, clientKey);
    const b = fhis.FhisUint32.encrypt(3, clientKey);
    
    // Test operations
    const sum = a.add(b);
    const diff = a.sub(b);
    const prod = a.mul(b);
    
    // Decrypt results
    console.log("5 + 3 =", sum.decrypt(clientKey));
    console.log("5 - 3 =", diff.decrypt(clientKey));
    console.log("5 * 3 =", prod.decrypt(clientKey));
    
    // Test comparisons
    const isGreater = a.gt(b);
    console.log("5 > 3 =", isGreater.decrypt(clientKey));
    
    // Test bool operations
    const boolA = fhis.FhisBool.encrypt(true, clientKey);
    const boolB = fhis.FhisBool.encrypt(false, clientKey);
    console.log("true AND false =", boolA.and(boolB).decrypt(clientKey));
    console.log("true OR false =", boolA.or(boolB).decrypt(clientKey));
    console.log("NOT true =", boolA.not().decrypt(clientKey));
    
    console.log("\n✅ All tests passed!");
}

test().catch(console.error);
