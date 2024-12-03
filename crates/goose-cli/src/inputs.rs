use cliclack::{input, password};

pub fn get_user_input_with_mask(input_prompt: &str, mask: bool) -> String {
    if mask {
        password(input_prompt).mask('▪').interact().unwrap()
    } else {
        input(input_prompt).interact().unwrap()
    }
}

pub fn get_user_input(message: &str, default_value: &str) -> std::io::Result<String> {
    input(message).default_input(default_value).interact()
}
