use crate::keys::{FhisClientKey, FhisServerKey};
use std::ops::{Shl, Shr};
use tfhe::prelude::{
    FheDecrypt, FheEq, FheMax, FheMin, FheOrd, FheTryEncrypt, FheTryTrivialEncrypt,
};
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
pub fn set_server_key(server_key: &FhisServerKey) -> Result<(), JsError> {
    catch_panic_result(|| {
        tfhe::set_server_key(server_key.0.clone());
        Ok(())
    })
}

#[wasm_bindgen]
pub struct FhisUint32(pub(crate) tfhe::FheUint32);

#[wasm_bindgen]
impl FhisUint32 {
    #[wasm_bindgen]
    pub fn encrypt(value: u32, client_key: &FhisClientKey) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| {
            Ok(FhisUint32(
                tfhe::FheUint32::try_encrypt(value, &client_key.0).map_err(into_js_error)?,
            ))
        })
    }

    #[wasm_bindgen]
    pub fn encrypt_trivial(value: u32) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| {
            Ok(FhisUint32(
                tfhe::FheUint32::try_encrypt_trivial(value).map_err(into_js_error)?,
            ))
        })
    }

    #[wasm_bindgen]
    pub fn decrypt(&self, client_key: &FhisClientKey) -> Result<u32, JsError> {
        catch_panic(|| self.0.decrypt(&client_key.0))
    }

    #[wasm_bindgen]
    pub fn serialize(&self) -> Result<Vec<u8>, JsError> {
        catch_panic_result(|| bincode::serialize(&self.0).map_err(into_js_error))
    }

    #[wasm_bindgen]
    pub fn deserialize(buffer: &[u8]) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| {
            bincode::deserialize(buffer)
                .map(FhisUint32)
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
    ) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| {
            tfhe::safe_serialization::DeserializationConfig::new(serialized_size_limit)
                .disable_conformance()
                .deserialize_from(buffer)
                .map(FhisUint32)
                .map_err(into_js_error)
        })
    }

    #[wasm_bindgen]
    pub fn add(&self, other: &FhisUint32) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| Ok(FhisUint32(&self.0 + &other.0)))
    }

    #[wasm_bindgen]
    pub fn add_scalar(&self, scalar: u32) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| Ok(FhisUint32(&self.0 + scalar)))
    }

    #[wasm_bindgen]
    pub fn sub(&self, other: &FhisUint32) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| Ok(FhisUint32(&self.0 - &other.0)))
    }

    #[wasm_bindgen]
    pub fn sub_scalar(&self, scalar: u32) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| Ok(FhisUint32(&self.0 - scalar)))
    }

    #[wasm_bindgen]
    pub fn mul(&self, other: &FhisUint32) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| Ok(FhisUint32(&self.0 * &other.0)))
    }

    #[wasm_bindgen]
    pub fn mul_scalar(&self, scalar: u32) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| Ok(FhisUint32(&self.0 * scalar)))
    }

    #[wasm_bindgen]
    pub fn bitand(&self, other: &FhisUint32) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| Ok(FhisUint32(&self.0 & &other.0)))
    }

    #[wasm_bindgen]
    pub fn bitor(&self, other: &FhisUint32) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| Ok(FhisUint32(&self.0 | &other.0)))
    }

    #[wasm_bindgen]
    pub fn bitxor(&self, other: &FhisUint32) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| Ok(FhisUint32(&self.0 ^ &other.0)))
    }

    #[wasm_bindgen]
    pub fn bitnot(&self) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| Ok(FhisUint32(!self.0.clone())))
    }

    #[wasm_bindgen]
    pub fn left_shift(&self, shift: u32) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| Ok(FhisUint32(Shl::shl(&self.0, shift))))
    }

    #[wasm_bindgen]
    pub fn right_shift(&self, shift: u32) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| Ok(FhisUint32(Shr::shr(&self.0, shift))))
    }

    #[wasm_bindgen]
    pub fn gt(&self, other: &FhisUint32) -> Result<crate::bool_ops::FhisBool, JsError> {
        catch_panic_result(|| Ok(crate::bool_ops::FhisBool(self.0.gt(&other.0))))
    }

    #[wasm_bindgen]
    pub fn lt(&self, other: &FhisUint32) -> Result<crate::bool_ops::FhisBool, JsError> {
        catch_panic_result(|| Ok(crate::bool_ops::FhisBool(self.0.lt(&other.0))))
    }

    #[wasm_bindgen]
    pub fn ge(&self, other: &FhisUint32) -> Result<crate::bool_ops::FhisBool, JsError> {
        catch_panic_result(|| Ok(crate::bool_ops::FhisBool(self.0.ge(&other.0))))
    }

    #[wasm_bindgen]
    pub fn le(&self, other: &FhisUint32) -> Result<crate::bool_ops::FhisBool, JsError> {
        catch_panic_result(|| Ok(crate::bool_ops::FhisBool(self.0.le(&other.0))))
    }

    #[wasm_bindgen]
    pub fn eq(&self, other: &FhisUint32) -> Result<crate::bool_ops::FhisBool, JsError> {
        catch_panic_result(|| Ok(crate::bool_ops::FhisBool(self.0.eq(&other.0))))
    }

    #[wasm_bindgen]
    pub fn ne(&self, other: &FhisUint32) -> Result<crate::bool_ops::FhisBool, JsError> {
        catch_panic_result(|| Ok(crate::bool_ops::FhisBool(self.0.ne(&other.0))))
    }

    #[wasm_bindgen]
    pub fn max(&self, other: &FhisUint32) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| Ok(FhisUint32(self.0.clone().max(&other.0))))
    }

    #[wasm_bindgen]
    pub fn min(&self, other: &FhisUint32) -> Result<FhisUint32, JsError> {
        catch_panic_result(|| Ok(FhisUint32(self.0.clone().min(&other.0))))
    }
}

#[wasm_bindgen]
pub struct FhisUint64(pub(crate) tfhe::FheUint64);

#[wasm_bindgen]
impl FhisUint64 {
    #[wasm_bindgen]
    pub fn encrypt(value: u64, client_key: &FhisClientKey) -> Result<FhisUint64, JsError> {
        catch_panic_result(|| {
            Ok(FhisUint64(
                tfhe::FheUint64::try_encrypt(value, &client_key.0).map_err(into_js_error)?,
            ))
        })
    }

    #[wasm_bindgen]
    pub fn encrypt_trivial(value: u64) -> Result<FhisUint64, JsError> {
        catch_panic_result(|| {
            Ok(FhisUint64(
                tfhe::FheUint64::try_encrypt_trivial(value).map_err(into_js_error)?,
            ))
        })
    }

    #[wasm_bindgen]
    pub fn decrypt(&self, client_key: &FhisClientKey) -> Result<u64, JsError> {
        catch_panic(|| self.0.decrypt(&client_key.0))
    }

    #[wasm_bindgen]
    pub fn serialize(&self) -> Result<Vec<u8>, JsError> {
        catch_panic_result(|| bincode::serialize(&self.0).map_err(into_js_error))
    }

    #[wasm_bindgen]
    pub fn deserialize(buffer: &[u8]) -> Result<FhisUint64, JsError> {
        catch_panic_result(|| {
            bincode::deserialize(buffer)
                .map(FhisUint64)
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
    ) -> Result<FhisUint64, JsError> {
        catch_panic_result(|| {
            tfhe::safe_serialization::DeserializationConfig::new(serialized_size_limit)
                .disable_conformance()
                .deserialize_from(buffer)
                .map(FhisUint64)
                .map_err(into_js_error)
        })
    }

    #[wasm_bindgen]
    pub fn add(&self, other: &FhisUint64) -> Result<FhisUint64, JsError> {
        catch_panic_result(|| Ok(FhisUint64(&self.0 + &other.0)))
    }

    #[wasm_bindgen]
    pub fn add_scalar(&self, scalar: u64) -> Result<FhisUint64, JsError> {
        catch_panic_result(|| Ok(FhisUint64(&self.0 + scalar)))
    }

    #[wasm_bindgen]
    pub fn sub(&self, other: &FhisUint64) -> Result<FhisUint64, JsError> {
        catch_panic_result(|| Ok(FhisUint64(&self.0 - &other.0)))
    }

    #[wasm_bindgen]
    pub fn sub_scalar(&self, scalar: u64) -> Result<FhisUint64, JsError> {
        catch_panic_result(|| Ok(FhisUint64(&self.0 - scalar)))
    }

    #[wasm_bindgen]
    pub fn mul(&self, other: &FhisUint64) -> Result<FhisUint64, JsError> {
        catch_panic_result(|| Ok(FhisUint64(&self.0 * &other.0)))
    }

    #[wasm_bindgen]
    pub fn mul_scalar(&self, scalar: u64) -> Result<FhisUint64, JsError> {
        catch_panic_result(|| Ok(FhisUint64(&self.0 * scalar)))
    }

    #[wasm_bindgen]
    pub fn bitand(&self, other: &FhisUint64) -> Result<FhisUint64, JsError> {
        catch_panic_result(|| Ok(FhisUint64(&self.0 & &other.0)))
    }

    #[wasm_bindgen]
    pub fn bitor(&self, other: &FhisUint64) -> Result<FhisUint64, JsError> {
        catch_panic_result(|| Ok(FhisUint64(&self.0 | &other.0)))
    }

    #[wasm_bindgen]
    pub fn bitxor(&self, other: &FhisUint64) -> Result<FhisUint64, JsError> {
        catch_panic_result(|| Ok(FhisUint64(&self.0 ^ &other.0)))
    }

    #[wasm_bindgen]
    pub fn gt(&self, other: &FhisUint64) -> Result<crate::bool_ops::FhisBool, JsError> {
        catch_panic_result(|| Ok(crate::bool_ops::FhisBool(self.0.gt(&other.0))))
    }

    #[wasm_bindgen]
    pub fn lt(&self, other: &FhisUint64) -> Result<crate::bool_ops::FhisBool, JsError> {
        catch_panic_result(|| Ok(crate::bool_ops::FhisBool(self.0.lt(&other.0))))
    }

    #[wasm_bindgen]
    pub fn ge(&self, other: &FhisUint64) -> Result<crate::bool_ops::FhisBool, JsError> {
        catch_panic_result(|| Ok(crate::bool_ops::FhisBool(self.0.ge(&other.0))))
    }

    #[wasm_bindgen]
    pub fn le(&self, other: &FhisUint64) -> Result<crate::bool_ops::FhisBool, JsError> {
        catch_panic_result(|| Ok(crate::bool_ops::FhisBool(self.0.le(&other.0))))
    }

    #[wasm_bindgen]
    pub fn eq(&self, other: &FhisUint64) -> Result<crate::bool_ops::FhisBool, JsError> {
        catch_panic_result(|| Ok(crate::bool_ops::FhisBool(self.0.eq(&other.0))))
    }

    #[wasm_bindgen]
    pub fn ne(&self, other: &FhisUint64) -> Result<crate::bool_ops::FhisBool, JsError> {
        catch_panic_result(|| Ok(crate::bool_ops::FhisBool(self.0.ne(&other.0))))
    }

    #[wasm_bindgen]
    pub fn max(&self, other: &FhisUint64) -> Result<FhisUint64, JsError> {
        catch_panic_result(|| Ok(FhisUint64(self.0.clone().max(&other.0))))
    }

    #[wasm_bindgen]
    pub fn min(&self, other: &FhisUint64) -> Result<FhisUint64, JsError> {
        catch_panic_result(|| Ok(FhisUint64(self.0.clone().min(&other.0))))
    }
}
