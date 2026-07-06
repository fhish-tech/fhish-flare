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
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct FhisClientKey(pub(crate) tfhe::ClientKey);

#[wasm_bindgen]
impl FhisClientKey {
    #[wasm_bindgen]
    pub fn generate(config: &FhisConfig) -> Result<FhisClientKey, JsError> {
        catch_panic_result(|| Ok(FhisClientKey(tfhe::ClientKey::generate(config.0.clone()))))
    }

    #[wasm_bindgen]
    pub fn generate_deterministic(config: &FhisConfig, seed_hi: u64, seed_lo: u64) -> Result<FhisClientKey, JsError> {
        use tfhe::core_crypto::commons::math::random::Seed;
        let seed = Seed((seed_hi as u128) << 64 | (seed_lo as u128));
        catch_panic_result(|| Ok(FhisClientKey(tfhe::ClientKey::generate_with_seed(config.0.clone(), seed))))
    }

    #[wasm_bindgen]
    pub fn serialize(&self) -> Result<Vec<u8>, JsError> {
        catch_panic_result(|| bincode::serialize(&self.0).map_err(into_js_error))
    }

    #[wasm_bindgen]
    pub fn deserialize(buffer: &[u8]) -> Result<FhisClientKey, JsError> {
        catch_panic_result(|| {
            bincode::deserialize(buffer)
                .map(FhisClientKey)
                .map_err(into_js_error)
        })
    }

    #[wasm_bindgen]
    pub fn safe_serialize(&self, serialized_size_limit: u64) -> Result<Vec<u8>, JsError> {
        let mut buffer = vec![];
        catch_panic_result(|| {
            tfhe::safe_serialization::SerializationConfig::new(serialized_size_limit)
                .serialize_into(&self.0, &mut buffer)
                .map_err(into_js_error)
        })?;
        Ok(buffer)
    }

    #[wasm_bindgen]
    pub fn safe_deserialize(
        buffer: &[u8],
        serialized_size_limit: u64,
    ) -> Result<FhisClientKey, JsError> {
        catch_panic_result(|| {
            tfhe::safe_serialization::DeserializationConfig::new(serialized_size_limit)
                .disable_conformance()
                .deserialize_from(buffer)
                .map(FhisClientKey)
                .map_err(into_js_error)
        })
    }
}

#[wasm_bindgen]
pub struct FhisServerKey(pub(crate) tfhe::ServerKey);

#[wasm_bindgen]
impl FhisServerKey {
    #[wasm_bindgen]
    pub fn new(client_key: &FhisClientKey) -> Result<FhisServerKey, JsError> {
        catch_panic_result(|| Ok(FhisServerKey(tfhe::ServerKey::new(&client_key.0))))
    }

    #[wasm_bindgen]
    pub fn serialize(&self) -> Result<Vec<u8>, JsError> {
        catch_panic_result(|| bincode::serialize(&self.0).map_err(into_js_error))
    }

    #[wasm_bindgen]
    pub fn deserialize(buffer: &[u8]) -> Result<FhisServerKey, JsError> {
        catch_panic_result(|| {
            bincode::deserialize(buffer)
                .map(FhisServerKey)
                .map_err(into_js_error)
        })
    }

    #[wasm_bindgen]
    pub fn safe_serialize(&self, serialized_size_limit: u64) -> Result<Vec<u8>, JsError> {
        let mut buffer = vec![];
        catch_panic_result(|| {
            tfhe::safe_serialization::SerializationConfig::new(serialized_size_limit)
                .serialize_into(&self.0, &mut buffer)
                .map_err(into_js_error)
        })?;
        Ok(buffer)
    }

    #[wasm_bindgen]
    pub fn safe_deserialize(
        buffer: &[u8],
        serialized_size_limit: u64,
    ) -> Result<FhisServerKey, JsError> {
        catch_panic_result(|| {
            tfhe::safe_serialization::DeserializationConfig::new(serialized_size_limit)
                .disable_conformance()
                .deserialize_from(buffer)
                .map(FhisServerKey)
                .map_err(into_js_error)
        })
    }
}

#[wasm_bindgen]
pub struct FhisCompressedServerKey(tfhe::CompressedServerKey);

#[wasm_bindgen]
impl FhisCompressedServerKey {
    #[wasm_bindgen]
    pub fn new(client_key: &FhisClientKey) -> Result<FhisCompressedServerKey, JsError> {
        catch_panic_result(|| {
            Ok(FhisCompressedServerKey(tfhe::CompressedServerKey::new(
                &client_key.0,
            )))
        })
    }

    #[wasm_bindgen]
    pub fn decompress(&self) -> Result<FhisServerKey, JsError> {
        catch_panic_result(|| Ok(FhisServerKey(self.0.decompress())))
    }

    #[wasm_bindgen]
    pub fn serialize(&self) -> Result<Vec<u8>, JsError> {
        catch_panic_result(|| bincode::serialize(&self.0).map_err(into_js_error))
    }

    #[wasm_bindgen]
    pub fn deserialize(buffer: &[u8]) -> Result<FhisCompressedServerKey, JsError> {
        catch_panic_result(|| {
            bincode::deserialize(buffer)
                .map(FhisCompressedServerKey)
                .map_err(into_js_error)
        })
    }
}

#[wasm_bindgen]
pub struct FhisPublicKey(tfhe::PublicKey);

#[wasm_bindgen]
impl FhisPublicKey {
    #[wasm_bindgen]
    pub fn new(client_key: &FhisClientKey) -> Result<FhisPublicKey, JsError> {
        catch_panic_result(|| Ok(FhisPublicKey(tfhe::PublicKey::new(&client_key.0))))
    }

    #[wasm_bindgen]
    pub fn serialize(&self) -> Result<Vec<u8>, JsError> {
        catch_panic_result(|| bincode::serialize(&self.0).map_err(into_js_error))
    }

    #[wasm_bindgen]
    pub fn deserialize(buffer: &[u8]) -> Result<FhisPublicKey, JsError> {
        catch_panic_result(|| {
            bincode::deserialize(buffer)
                .map(FhisPublicKey)
                .map_err(into_js_error)
        })
    }
}

#[wasm_bindgen]
pub struct FhisCompactPublicKey(pub(crate) tfhe::CompressedPublicKey);

#[wasm_bindgen]
impl FhisCompactPublicKey {
    #[wasm_bindgen]
    pub fn new(client_key: &FhisClientKey) -> Result<FhisCompactPublicKey, JsError> {
        catch_panic_result(|| {
            Ok(FhisCompactPublicKey(tfhe::CompressedPublicKey::new(
                &client_key.0,
            )))
        })
    }

    #[wasm_bindgen]
    pub fn serialize(&self) -> Result<Vec<u8>, JsError> {
        catch_panic_result(|| bincode::serialize(&self.0).map_err(into_js_error))
    }

    #[wasm_bindgen]
    pub fn deserialize(buffer: &[u8]) -> Result<FhisCompactPublicKey, JsError> {
        catch_panic_result(|| {
            bincode::deserialize(buffer)
                .map(FhisCompactPublicKey)
                .map_err(into_js_error)
        })
    }
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct FhisConfig(tfhe::Config);

#[wasm_bindgen]
impl FhisConfig {
    #[wasm_bindgen(constructor)]
    pub fn default() -> FhisConfig {
        FhisConfig(tfhe::ConfigBuilder::default().build())
    }
}
