use wasm_bindgen::prelude::*;

fn catch_panic_result<F, R>(closure: F) -> Result<R, JsError>
where
    F: FnOnce() -> Result<R, JsError>,
{
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(closure))
        .unwrap_or_else(|_| Err(JsError::new("Operation Failed")))
}

fn into_js_error<E: std::fmt::Display>(e: E) -> JsError {
    JsError::new(&e.to_string())
}

#[wasm_bindgen]
pub struct FhisShortintUint2(tfhe::shortint::Ciphertext);

#[wasm_bindgen]
impl FhisShortintUint2 {
    #[wasm_bindgen]
    pub fn encrypt(
        value: u8,
        public_key: &FhisShortintPublicKey,
    ) -> Result<FhisShortintUint2, JsError> {
        catch_panic_result(|| {
            let ct = public_key.0.encrypt(value as u64);
            Ok(FhisShortintUint2(ct))
        })
    }

    #[wasm_bindgen]
    pub fn encrypt_compact(
        value: u8,
        compact_public_key: &FhisShortintCompactPublicKey,
    ) -> Result<FhisShortintCompactCiphertextList, JsError> {
        compact_public_key.encrypt(value)
    }

    #[wasm_bindgen]
    pub fn decrypt(&self, client_key: &FhisShortintClientKey) -> Result<u8, JsError> {
        catch_panic_result(|| Ok(client_key.0.decrypt(&self.0) as u8))
    }

    #[wasm_bindgen]
    pub fn decrypt_full(&self, client_key: &FhisShortintClientKey) -> Result<u64, JsError> {
        catch_panic_result(|| Ok(client_key.0.decrypt_message_and_carry(&self.0)))
    }

    #[wasm_bindgen]
    pub fn serialize(&self) -> Result<Vec<u8>, JsError> {
        catch_panic_result(|| bincode::serialize(&self.0).map_err(into_js_error))
    }

    #[wasm_bindgen]
    pub fn deserialize(buffer: &[u8]) -> Result<FhisShortintUint2, JsError> {
        catch_panic_result(|| {
            bincode::deserialize(buffer)
                .map(FhisShortintUint2)
                .map_err(into_js_error)
        })
    }
}

#[wasm_bindgen]
pub struct FhisShortintClientKey(tfhe::shortint::ClientKey);

#[wasm_bindgen]
impl FhisShortintClientKey {
    #[wasm_bindgen]
    pub fn new(config: &FhisShortintConfig) -> Result<FhisShortintClientKey, JsError> {
        catch_panic_result(|| {
            let params: tfhe::shortint::AtomicPatternParameters = config.0.clone().into();
            Ok(FhisShortintClientKey(tfhe::shortint::ClientKey::new(
                params,
            )))
        })
    }

    #[wasm_bindgen]
    pub fn encrypt(&self, value: u8) -> Result<FhisShortintUint2, JsError> {
        catch_panic_result(|| {
            let ct = self.0.encrypt(value as u64);
            Ok(FhisShortintUint2(ct))
        })
    }

    #[wasm_bindgen]
    pub fn serialize(&self) -> Result<Vec<u8>, JsError> {
        catch_panic_result(|| bincode::serialize(&self.0).map_err(into_js_error))
    }

    #[wasm_bindgen]
    pub fn deserialize(buffer: &[u8]) -> Result<FhisShortintClientKey, JsError> {
        catch_panic_result(|| {
            bincode::deserialize(buffer)
                .map(FhisShortintClientKey)
                .map_err(into_js_error)
        })
    }
}

#[wasm_bindgen]
pub struct FhisShortintPublicKey(tfhe::shortint::PublicKey);

#[wasm_bindgen]
impl FhisShortintPublicKey {
    #[wasm_bindgen]
    pub fn new(client_key: &FhisShortintClientKey) -> Result<FhisShortintPublicKey, JsError> {
        catch_panic_result(|| {
            Ok(FhisShortintPublicKey(tfhe::shortint::PublicKey::new(
                &client_key.0,
            )))
        })
    }

    #[wasm_bindgen]
    pub fn encrypt(&self, value: u8) -> FhisShortintUint2 {
        let ct = self.0.encrypt(value as u64);
        FhisShortintUint2(ct)
    }

    #[wasm_bindgen]
    pub fn serialize(&self) -> Vec<u8> {
        bincode::serialize(&self.0).unwrap_or_default()
    }

    #[wasm_bindgen]
    pub fn deserialize(buffer: &[u8]) -> Result<FhisShortintPublicKey, JsError> {
        catch_panic_result(|| {
            bincode::deserialize(buffer)
                .map(FhisShortintPublicKey)
                .map_err(into_js_error)
        })
    }
}

#[wasm_bindgen]
pub struct FhisShortintServerKey(tfhe::shortint::ServerKey);

#[wasm_bindgen]
impl FhisShortintServerKey {
    #[wasm_bindgen]
    pub fn new(client_key: &FhisShortintClientKey) -> Result<FhisShortintServerKey, JsError> {
        catch_panic_result(|| {
            Ok(FhisShortintServerKey(tfhe::shortint::ServerKey::new(
                &client_key.0,
            )))
        })
    }

    #[wasm_bindgen]
    pub fn serialize(&self) -> Result<Vec<u8>, JsError> {
        catch_panic_result(|| bincode::serialize(&self.0).map_err(into_js_error))
    }

    #[wasm_bindgen]
    pub fn deserialize(buffer: &[u8]) -> Result<FhisShortintServerKey, JsError> {
        catch_panic_result(|| {
            bincode::deserialize(buffer)
                .map(FhisShortintServerKey)
                .map_err(into_js_error)
        })
    }

    #[wasm_bindgen]
    pub fn add(
        &self,
        ct1: &FhisShortintUint2,
        ct2: &FhisShortintUint2,
    ) -> Result<FhisShortintUint2, JsError> {
        catch_panic_result(|| {
            let result = self.0.add(&ct1.0, &ct2.0);
            Ok(FhisShortintUint2(result))
        })
    }

    #[wasm_bindgen]
    pub fn sub(
        &self,
        ct1: &FhisShortintUint2,
        ct2: &FhisShortintUint2,
    ) -> Result<FhisShortintUint2, JsError> {
        catch_panic_result(|| {
            let result = self.0.sub(&ct1.0, &ct2.0);
            Ok(FhisShortintUint2(result))
        })
    }

    #[wasm_bindgen]
    pub fn mul(
        &self,
        ct1: &FhisShortintUint2,
        ct2: &FhisShortintUint2,
    ) -> Result<FhisShortintUint2, JsError> {
        catch_panic_result(|| {
            let result = self.0.mul(&ct1.0, &ct2.0);
            Ok(FhisShortintUint2(result))
        })
    }
}

#[wasm_bindgen]
pub struct FhisShortintConfig(tfhe::shortint::ClassicPBSParameters);

#[wasm_bindgen]
impl FhisShortintConfig {
    #[wasm_bindgen(constructor)]
    pub fn default() -> FhisShortintConfig {
        FhisShortintConfig(tfhe::shortint::parameters::PARAM_MESSAGE_2_CARRY_2_KS_PBS)
    }

    #[wasm_bindgen]
    pub fn small() -> FhisShortintConfig {
        FhisShortintConfig(tfhe::shortint::parameters::PARAM_MESSAGE_2_CARRY_2_KS_PBS)
    }

    #[wasm_bindgen]
    pub fn compact_pk() -> FhisShortintConfig {
        FhisShortintConfig(
            tfhe::shortint::parameters::v1_1::V1_1_PARAM_MESSAGE_1_CARRY_1_COMPACT_PK_KS_PBS_GAUSSIAN_2M64,
        )
    }

    #[wasm_bindgen]
    pub fn pbs_ks_small() -> FhisShortintConfig {
        FhisShortintConfig(
            tfhe::shortint::parameters::v1_1::V1_1_PARAM_MESSAGE_1_CARRY_1_COMPACT_PK_PBS_KS_GAUSSIAN_2M64,
        )
    }

    #[wasm_bindgen]
    pub fn compact_pk_v1() -> FhisShortintConfig {
        FhisShortintConfig(
            tfhe::shortint::parameters::v1_1::V1_1_PARAM_MESSAGE_1_CARRY_0_COMPACT_PK_KS_PBS_GAUSSIAN_2M64,
        )
    }

    #[wasm_bindgen]
    pub fn carry_1() -> FhisShortintConfig {
        FhisShortintConfig(
            tfhe::shortint::parameters::v1_1::V1_1_PARAM_MESSAGE_1_CARRY_1_COMPACT_PK_KS_PBS_GAUSSIAN_2M64,
        )
    }

    #[wasm_bindgen]
    pub fn carry_2() -> FhisShortintConfig {
        FhisShortintConfig(
            tfhe::shortint::parameters::v1_1::V1_1_PARAM_MESSAGE_1_CARRY_2_COMPACT_PK_KS_PBS_GAUSSIAN_2M64,
        )
    }

    #[wasm_bindgen]
    pub fn carry_2_128bit() -> FhisShortintConfig {
        FhisShortintConfig(
            tfhe::shortint::parameters::v1_1::V1_1_PARAM_MESSAGE_1_CARRY_2_COMPACT_PK_KS_PBS_GAUSSIAN_2M128,
        )
    }
}

#[wasm_bindgen]
pub struct FhisShortintCompactPublicKey(tfhe::shortint::CompactPublicKey);

#[wasm_bindgen]
impl FhisShortintCompactPublicKey {
    #[wasm_bindgen]
    pub fn new(
        client_key: &FhisShortintClientKey,
    ) -> Result<FhisShortintCompactPublicKey, JsError> {
        catch_panic_result(|| {
            let compact_pk = tfhe::shortint::CompactPublicKey::new(&client_key.0);
            Ok(FhisShortintCompactPublicKey(compact_pk))
        })
    }

    #[wasm_bindgen]
    pub fn serialize(&self) -> Result<Vec<u8>, JsError> {
        catch_panic_result(|| bincode::serialize(&self.0).map_err(into_js_error))
    }

    #[wasm_bindgen]
    pub fn deserialize(buffer: &[u8]) -> Result<FhisShortintCompactPublicKey, JsError> {
        catch_panic_result(|| {
            bincode::deserialize(buffer)
                .map(FhisShortintCompactPublicKey)
                .map_err(into_js_error)
        })
    }

    #[wasm_bindgen]
    pub fn size_bytes(&self) -> usize {
        self.0.size_bytes()
    }

    #[wasm_bindgen]
    pub fn encrypt(&self, value: u8) -> Result<FhisShortintCompactCiphertextList, JsError> {
        catch_panic_result(|| {
            let ct_list = self.0.encrypt_slice(&[value as u64]);
            Ok(FhisShortintCompactCiphertextList(ct_list))
        })
    }
}

#[wasm_bindgen]
pub struct FhisShortintCompactCiphertextList(tfhe::shortint::ciphertext::CompactCiphertextList);

#[wasm_bindgen]
impl FhisShortintCompactCiphertextList {
    #[wasm_bindgen]
    pub fn expand(&self) -> Result<FhisShortintUint2, JsError> {
        catch_panic_result(|| {
            let ciphertexts = self
                .0
                .expand(
                    tfhe::shortint::parameters::ShortintCompactCiphertextListCastingMode::NoCasting,
                )
                .map_err(into_js_error)?;
            if ciphertexts.is_empty() {
                return Err(JsError::new("Empty ciphertext list"));
            }
            Ok(FhisShortintUint2(ciphertexts.into_iter().next().unwrap()))
        })
    }

    #[wasm_bindgen]
    pub fn serialize(&self) -> Vec<u8> {
        bincode::serialize(&self.0).unwrap_or_default()
    }

    #[wasm_bindgen]
    pub fn deserialize(buffer: &[u8]) -> Result<FhisShortintCompactCiphertextList, JsError> {
        catch_panic_result(|| {
            bincode::deserialize(buffer)
                .map(FhisShortintCompactCiphertextList)
                .map_err(into_js_error)
        })
    }

    #[wasm_bindgen]
    pub fn size_bytes(&self) -> usize {
        self.0.size_bytes()
    }
}

#[wasm_bindgen]
pub struct FhisShortintCompressedPublicKey(tfhe::shortint::CompressedCompactPublicKey);

#[wasm_bindgen]
impl FhisShortintCompressedPublicKey {
    #[wasm_bindgen]
    pub fn new(
        client_key: &FhisShortintClientKey,
    ) -> Result<FhisShortintCompressedPublicKey, JsError> {
        catch_panic_result(|| {
            let compressed_pk = tfhe::shortint::CompressedCompactPublicKey::new(&client_key.0);
            Ok(FhisShortintCompressedPublicKey(compressed_pk))
        })
    }

    #[wasm_bindgen]
    pub fn decompress(&self) -> Result<FhisShortintCompactPublicKey, JsError> {
        catch_panic_result(|| {
            let decompressed = self.0.decompress();
            Ok(FhisShortintCompactPublicKey(decompressed))
        })
    }

    #[wasm_bindgen]
    pub fn serialize(&self) -> Vec<u8> {
        bincode::serialize(&self.0).unwrap_or_default()
    }

    #[wasm_bindgen]
    pub fn deserialize(buffer: &[u8]) -> Result<FhisShortintCompressedPublicKey, JsError> {
        catch_panic_result(|| {
            bincode::deserialize(buffer)
                .map(FhisShortintCompressedPublicKey)
                .map_err(into_js_error)
        })
    }
}
