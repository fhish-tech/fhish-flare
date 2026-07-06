use std::env;
use std::fs;
use std::path::Path;

fn main() {
    println!("FHISH Shortint Key Generator for Voting");
    println!("========================================");

    // Use PARAM_MESSAGE_2_CARRY_2_KS_PBS for voting (allows counting up to 15)
    use tfhe::shortint::parameters::ShortintCompactCiphertextListCastingMode;
    use tfhe::shortint::parameters::PARAM_MESSAGE_2_CARRY_2_KS_PBS;

    let params = PARAM_MESSAGE_2_CARRY_2_KS_PBS;
    println!("Generating shortint keys with PARAM_MESSAGE_2_CARRY_2_KS_PBS...");
    println!("  Message bits: 2, Carry bits: 2");
    println!("  Max votes per ciphertext: 15");

    // Generate client key
    let client_key = tfhe::shortint::ClientKey::new(params);
    println!("\nClient key generated");

    // Generate COMPACT public key (much smaller than regular PublicKey)
    let compact_public_key = tfhe::shortint::CompactPublicKey::new(&client_key);
    println!("Compact public key generated");

    // Generate server key
    let server_key = tfhe::shortint::ServerKey::new(&client_key);
    println!("Server key generated");

    // Serialize keys
    let client_bytes = bincode::serialize(&client_key).expect("Failed to serialize client key");
    let public_bytes =
        bincode::serialize(&compact_public_key).expect("Failed to serialize public key");
    let server_bytes = bincode::serialize(&server_key).expect("Failed to serialize server key");

    println!("\nKey sizes:");
    println!(
        "  Client key: {} bytes ({:.1} KB)",
        client_bytes.len(),
        client_bytes.len() as f64 / 1024.0
    );
    println!(
        "  Compact public key: {} bytes ({:.1} KB)",
        public_bytes.len(),
        public_bytes.len() as f64 / 1024.0
    );
    println!(
        "  Server key: {} bytes ({:.1} MB)",
        server_bytes.len(),
        server_bytes.len() as f64 / (1024.0 * 1024.0)
    );

    // Get output directory from args or use current directory
    let output_dir = env::args().nth(1).unwrap_or_else(|| ".".to_string());

    // Ensure directory exists
    fs::create_dir_all(&output_dir).expect("Failed to create output directory");

    // Save keys
    let client_path = Path::new(&output_dir).join("shortint_client_key.bin");
    let public_path = Path::new(&output_dir).join("shortint_public_key.bin");
    let server_path = Path::new(&output_dir).join("shortint_server_key.bin");

    fs::write(&client_path, &client_bytes).expect("Failed to write client key");
    fs::write(&public_path, &public_bytes).expect("Failed to write public key");
    fs::write(&server_path, &server_bytes).expect("Failed to write server key");

    println!("\nKeys saved to:");
    println!("  {}", client_path.display());
    println!("  {}", public_path.display());
    println!("  {}", server_path.display());

    // Save metadata
    let metadata = serde_json::json!({
        "type": "FhisShortint",
        "parameters": "PARAM_MESSAGE_2_CARRY_2_KS_PBS",
        "message_bits": 2,
        "carry_bits": 2,
        "max_value": 15,
        "created": "2026-04-10",
        "note": "CompactPublicKey. Use expand() to get Ciphertext for operations."
    });
    let metadata_path = Path::new(&output_dir).join("key_metadata.json");
    fs::write(
        &metadata_path,
        serde_json::to_string_pretty(&metadata).unwrap(),
    )
    .expect("Failed to write metadata");
    println!("  {}", metadata_path.display());

    // Helper to encrypt value using compact public key
    fn encrypt_value(
        public_key: &tfhe::shortint::CompactPublicKey,
        value: u64,
    ) -> tfhe::shortint::Ciphertext {
        let ct_list = public_key.encrypt_slice(&[value]);
        let cts = ct_list
            .expand(ShortintCompactCiphertextListCastingMode::NoCasting)
            .expect("Failed to expand ciphertext");
        cts.into_iter().next().expect("Empty ciphertext list")
    }

    // Helper to decrypt and show details
    fn decrypt_with_details(
        client_key: &tfhe::shortint::ClientKey,
        ct: &tfhe::shortint::Ciphertext,
        label: &str,
    ) {
        let decrypted = client_key.decrypt(ct);
        let msg_and_carry = client_key.decrypt_message_and_carry(ct);
        println!(
            "  {}: decrypt()={}, decrypt_message_and_carry()={}",
            label, decrypted, msg_and_carry
        );
    }

    // Test single vote
    println!("\n=== Testing accumulation ===");
    let ct1 = encrypt_value(&compact_public_key, 1);
    decrypt_with_details(&client_key, &ct1, "1 vote");

    // Test 2 votes
    let ct2 = encrypt_value(&compact_public_key, 1);
    let sum2 = server_key.add(&ct1, &ct2);
    decrypt_with_details(&client_key, &sum2, "2 votes (1+1)");

    // Test 5 votes
    let mut acc = encrypt_value(&compact_public_key, 1);
    for _ in 0..4 {
        acc = server_key.add(&acc, &encrypt_value(&compact_public_key, 1));
    }
    decrypt_with_details(&client_key, &acc, "5 votes");

    // Test 10 votes
    let mut acc = encrypt_value(&compact_public_key, 1);
    for _ in 0..9 {
        acc = server_key.add(&acc, &encrypt_value(&compact_public_key, 1));
    }
    decrypt_with_details(&client_key, &acc, "10 votes");

    // Test 15 votes
    let mut acc = encrypt_value(&compact_public_key, 1);
    for _ in 0..14 {
        acc = server_key.add(&acc, &encrypt_value(&compact_public_key, 1));
    }
    decrypt_with_details(&client_key, &acc, "15 votes");

    // Test 16 votes (overflow)
    let mut acc = encrypt_value(&compact_public_key, 1);
    for _ in 0..15 {
        acc = server_key.add(&acc, &encrypt_value(&compact_public_key, 1));
    }
    decrypt_with_details(&client_key, &acc, "16 votes (overflow)");

    // Check ciphertext size
    let ct = encrypt_value(&compact_public_key, 1);
    let ct_serialized = bincode::serialize(&ct).expect("Failed to serialize ciphertext");
    println!(
        "\nCiphertext size: {} bytes (~{:.1} KB)",
        ct_serialized.len(),
        ct_serialized.len() as f64 / 1024.0
    );

    println!("\n✅ Shortint key generation complete!");
    println!("\nIMPORTANT: Use decrypt_message_and_carry() for voting to get the full count!");
}
