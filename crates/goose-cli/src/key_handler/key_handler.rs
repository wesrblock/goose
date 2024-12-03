use std::process;
use cliclack::confirm;
use goose::key_manager::{key_value_in_environment_variable, key_value_in_key_chain, save_to_keyring};
use crate::inputs::get_user_input_with_mask;

pub fn get_key(key_name: &str) -> Result<String, Box<dyn std::error::Error>> {
    match key_value_in_key_chain(key_name) {
        Some(value) => Ok(value),
        None => {
            match key_value_in_environment_variable(key_name) {
                Some(value) => Ok(value),
                None => {
                    println!("Key {} not found in keyring or environment variable. Please set the key via goose configure", key_name);
                    process::exit(1)
                }
            }
        }
    }
}
pub fn get_or_set_key(
    human_readable_name: &str,
    key_name: &str,
    only_get_key: bool,
) -> Result<String, Box<dyn std::error::Error>> {
    if only_get_key {
        return get_key(key_name)
    }
    println!("Checking for key {} setup for {} in keyring. ", key_name, human_readable_name);
    match key_value_in_key_chain(key_name) {
        Some(value ) => {
            let should_save_key_in_keyring = confirm("You have set the key in the keyring. Would you like to update this key?").interact()?;
            if !should_save_key_in_keyring {
                return Ok(value);
            }
        }
        None => {
            match key_value_in_environment_variable(key_name) {
                Some(value) => {
                    if only_get_key {
                        return Ok(value);
                    }
                    let should_save_key_in_keyring = confirm("You have set the key as the environment variable. Would you like to save this key to the keyring?").interact()?;
                    if !should_save_key_in_keyring {
                        return Ok(value);
                    }
                }
                None => {}
            }
        }
    }
    let prompt = format!("Please enter key {} in keyring", key_name);
    let key_val = get_user_input_with_mask(&prompt, key_name.ends_with("KEY"));
    match save_to_keyring(key_name, &key_val) {
        Ok(_) => println!("Successfully saved key {} to system keyring", key_name),
        Err(_) => {
            println!("Warning: Failed to save key to system keyring: {}", key_name);
        }
    }
    Ok(key_val)
}