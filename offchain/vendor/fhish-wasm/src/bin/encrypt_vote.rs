use std::fs;
use std::path::Path;
use tfhe::shortint::parameters::ShortintCompactCiphertextListCastingMode;

fn main() {
    let output_dir = ".";
    let public_path = Path::new("../../fhish-gateway/keys-shortint/shortint_public_key.bin");
    
    let public_bytes = fs::read(&public_path).expect("Failed to read public key");
    let compact_public_key: tfhe::shortint::CompactPublicKey = bincode::deserialize(&public_bytes).expect("Failed to deserialize");

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

    let ct_yes = encrypt_value(&compact_public_key, 1);
    let ct_no = encrypt_value(&compact_public_key, 0);

    let yes_bytes = bincode::serialize(&ct_yes).unwrap();
    let no_bytes = bincode::serialize(&ct_no).unwrap();

    fs::write("ct_yes.bin", yes_bytes).unwrap();
    fs::write("ct_no.bin", no_bytes).unwrap();

    println!("Ciphertexts generated: ct_yes.bin, ct_no.bin");
}
