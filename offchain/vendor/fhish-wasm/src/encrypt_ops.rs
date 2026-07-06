use crate::keys::FhisCompactPublicKey;
use crate::{FhisBool, FhisUint32, FhisUint64};
use tfhe::prelude::FheTryEncrypt;
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
impl FhisUint32 {
    #[wasm_bindgen]
    pub fn encrypt_with_public_key(
        value: u32,
        public_key: &FhisCompactPublicKey,
    ) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| {
            Ok(FhisUint32(
                tfhe::FheUint32::try_encrypt(value, &public_key.0).map_err(into_js_error)?,
            ))
        })
    }
}

#[wasm_bindgen]
impl FhisUint64 {
    #[wasm_bindgen]
    pub fn encrypt_with_public_key(
        value: u64,
        public_key: &FhisCompactPublicKey,
    ) -> Result<FhisUint64, JsError> {
        catch_panic_result(|| {
            Ok(FhisUint64(
                tfhe::FheUint64::try_encrypt(value, &public_key.0).map_err(into_js_error)?,
            ))
        })
    }
}

#[wasm_bindgen]
impl FhisBool {
    #[wasm_bindgen]
    pub fn encrypt_with_public_key(
        value: bool,
        public_key: &FhisCompactPublicKey,
    ) -> Result<FhisBool, JsError> {
        catch_panic_result(|| {
            Ok(FhisBool(
                tfhe::FheBool::try_encrypt(value, &public_key.0).map_err(into_js_error)?,
            ))
        })
    }
}
