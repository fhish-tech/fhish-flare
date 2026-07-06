use std::env;
use std::fs;
use std::path::Path;

fn main() {
    println!("FHISH Generic FHE Key Generator");
    println!("================================\n");

    // Generate keys using the generic FHE config (integers, bools)
    println!("Generating FHE keys with default config...");

    let config = tfhe::ConfigBuilder::default().build();
    let client_key = tfhe::ClientKey::generate(config);
    let server_key = tfhe::ServerKey::new(&client_key);
    let public_key = tfhe::PublicKey::new(&client_key);

    println!("Keys generated successfully!\n");

    // Serialize keys using bincode
    let client_bytes = bincode::serialize(&client_key).expect("Failed to serialize client key");
    let server_bytes = bincode::serialize(&server_key).expect("Failed to serialize server key");
    let public_bytes = bincode::serialize(&public_key).expect("Failed to serialize public key");

    println!("=== Key Sizes ===");
    println!(
        "Client Key: {} bytes ({:.2} KB)",
        client_bytes.len(),
        client_bytes.len() as f64 / 1024.0
    );
    println!(
        "Server Key: {} bytes ({:.2} MB)",
        server_bytes.len(),
        server_bytes.len() as f64 / (1024.0 * 1024.0)
    );
    println!(
        "Public Key: {} bytes ({:.2} KB)",
        public_bytes.len(),
        public_bytes.len() as f64 / 1024.0
    );

    // Get output directory
    let output_dir = env::args().nth(1).unwrap_or_else(|| ".".to_string());
    fs::create_dir_all(&output_dir).expect("Failed to create output directory");

    // Save keys
    let client_path = Path::new(&output_dir).join("fhe_client_key.bin");
    let server_path = Path::new(&output_dir).join("fhe_server_key.bin");
    let public_path = Path::new(&output_dir).join("fhe_public_key.bin");

    fs::write(&client_path, &client_bytes).expect("Failed to write client key");
    fs::write(&server_path, &server_bytes).expect("Failed to write server key");
    fs::write(&public_path, &public_bytes).expect("Failed to write public key");

    println!("\nKeys saved to:");
    println!("  {}", client_path.display());
    println!("  {}", server_path.display());
    println!("  {}", public_path.display());

    // Test operations with integer types
    println!("\n=== Testing Operations ===");

    // Import required traits for operations
    use tfhe::prelude::*;

    // Set the server key for operations
    tfhe::set_server_key(server_key.clone());

    // Test Uint32
    println!("\nUint32:");
    let ct1: tfhe::FheUint32 =
        tfhe::FheUint32::try_encrypt(100u32, &client_key).expect("Failed to encrypt");
    let ct2: tfhe::FheUint32 =
        tfhe::FheUint32::try_encrypt(200u32, &client_key).expect("Failed to encrypt");

    let sum = &ct1 + &ct2;
    let sum_dec: u32 = sum.decrypt(&client_key);
    println!("  100 + 200 = {} (expected: 300)", sum_dec);

    let diff = &sum - &ct2;
    let diff_dec: u32 = diff.decrypt(&client_key);
    println!("  300 - 200 = {} (expected: 100)", diff_dec);

    let prod = &ct1 * &ct2;
    let prod_dec: u32 = prod.decrypt(&client_key);
    println!("  100 * 200 = {} (expected: 20000)", prod_dec);

    // Test comparisons
    let gt = ct1.gt(&ct2);
    let gt_dec: bool = gt.decrypt(&client_key);
    println!("  100 > 200 = {} (expected: false)", gt_dec);

    let lt = ct1.lt(&ct2);
    let lt_dec: bool = lt.decrypt(&client_key);
    println!("  100 < 200 = {} (expected: true)", lt_dec);

    // Test Uint64
    println!("\nUint64:");
    let big1: tfhe::FheUint64 =
        tfhe::FheUint64::try_encrypt(9999999999999u64, &client_key).expect("Failed to encrypt");
    let big2: tfhe::FheUint64 =
        tfhe::FheUint64::try_encrypt(1u64, &client_key).expect("Failed to encrypt");

    let big_sum = &big1 + &big2;
    let big_sum_dec: u64 = big_sum.decrypt(&client_key);
    println!(
        "  9999999999999 + 1 = {} (expected: 10000000000000)",
        big_sum_dec
    );

    // Test Bool
    println!("\nBool:");
    let bt: tfhe::FheBool =
        tfhe::FheBool::try_encrypt(true, &client_key).expect("Failed to encrypt");
    let bf: tfhe::FheBool =
        tfhe::FheBool::try_encrypt(false, &client_key).expect("Failed to encrypt");

    let bt_dec: bool = bt.decrypt(&client_key);
    let bf_dec: bool = bf.decrypt(&client_key);
    println!("  true = {} (expected: true)", bt_dec);
    println!("  false = {} (expected: false)", bf_dec);

    let and_result = bt.clone() & bf;
    let and_dec: bool = and_result.decrypt(&client_key);
    println!("  true AND false = {} (expected: false)", and_dec);

    println!("\n✅ FHISH Generic FHE Key Generation Complete!");
}
