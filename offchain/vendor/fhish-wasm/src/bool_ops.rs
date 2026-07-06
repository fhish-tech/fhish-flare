use crate::keys::FhisClientKey;
use tfhe::prelude::{FheDecrypt, FheTryEncrypt, IfThenElse};
use wasm_bindgen::prelude::*;

fn catch_panic_result<F, R>(closure: F) -> Result<R, JsError>
where
    F: FnOnce() -> Result<R, JsError>,
{
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(closure))
        .unwrap_or_else(|_| Err(JsError::new("Operation Failed")))
}

fn catch_panic<F, R>(closure: F) -> Result<R, JsError>
where
    F: FnOnce() -> R,
{
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(closure))
        .map_or_else(|_| Err(JsError::new("Operation Failed")), |ret| Ok(ret))
}

fn into_js_error<E: std::fmt::Display>(e: E) -> JsError {
    JsError::new(&e.to_string())
}

#[wasm_bindgen]
pub struct FhisBool(pub(crate) tfhe::FheBool);

#[wasm_bindgen]
impl FhisBool {
    #[wasm_bindgen]
    pub fn encrypt(value: bool, client_key: &FhisClientKey) -> Result<FhisBool, JsError> {
        catch_panic_result(|| {
            Ok(FhisBool(
                tfhe::FheBool::try_encrypt(value, &client_key.0).map_err(into_js_error)?,
            ))
        })
    }

    #[wasm_bindgen]
    pub fn decrypt(&self, client_key: &FhisClientKey) -> Result<bool, JsError> {
        catch_panic(|| self.0.decrypt(&client_key.0))
    }

    #[wasm_bindgen]
    pub fn serialize(&self) -> Result<Vec<u8>, JsError> {
        catch_panic_result(|| bincode::serialize(&self.0).map_err(into_js_error))
    }

    #[wasm_bindgen]
    pub fn deserialize(buffer: &[u8]) -> Result<FhisBool, JsError> {
        catch_panic_result(|| {
            bincode::deserialize(buffer)
                .map(FhisBool)
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
    ) -> Result<FhisBool, JsError> {
        catch_panic_result(|| {
            tfhe::safe_serialization::DeserializationConfig::new(serialized_size_limit)
                .disable_conformance()
                .deserialize_from(buffer)
                .map(FhisBool)
                .map_err(into_js_error)
        })
    }

    #[wasm_bindgen]
    pub fn not(&self) -> Result<FhisBool, JsError> {
        catch_panic_result(|| Ok(FhisBool(!self.0.clone())))
    }

    #[wasm_bindgen]
    pub fn and(&self, other: &FhisBool) -> Result<FhisBool, JsError> {
        catch_panic_result(|| Ok(FhisBool(&self.0 & &other.0)))
    }

    #[wasm_bindgen]
    pub fn or(&self, other: &FhisBool) -> Result<FhisBool, JsError> {
        catch_panic_result(|| Ok(FhisBool(&self.0 | &other.0)))
    }

    #[wasm_bindgen]
    pub fn xor(&self, other: &FhisBool) -> Result<FhisBool, JsError> {
        catch_panic_result(|| Ok(FhisBool(&self.0 ^ &other.0)))
    }

    #[wasm_bindgen]
    pub fn mux(&self, then_: &FhisBool, else_: &FhisBool) -> Result<FhisBool, JsError> {
        catch_panic_result(|| {
            let result = self.0.clone().cmux(&then_.0, &else_.0);
            Ok(FhisBool(result))
        })
    }
}
