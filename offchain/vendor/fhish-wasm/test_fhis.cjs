const fhis = require("./dist/fhish_wasm.js");

async function test() {
    await fhis.default();
    
    const config = new fhis.FhisConfig();
    const clientKey = new fhis.FhisClientKey();
    clientKey.generate(config);
    
    const serverKey = new fhis.FhisServerKey();
    serverKey.new(clientKey);
    
    fhis.set_server_key(serverKey);
    
    const a = fhis.FhisUint32.encrypt(5, clientKey);
    const b = fhis.FhisUint32.encrypt(3, clientKey);
    
    const sum = a.add(b);
    console.log("5 + 3 =", sum.decrypt(clientKey));
    
    console.log("\n✅ Basic test passed!");
}

test().catch(console.error);
