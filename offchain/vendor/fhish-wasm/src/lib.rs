mod bool_ops;
mod encrypt_ops;
mod keys;
mod server_ops;
mod shortint_ops;

pub use bool_ops::*;
pub use keys::*;
pub use server_ops::*;
pub use shortint_ops::*;

use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
}
