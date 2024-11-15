use cliclack::input;

pub fn get_env_value_or_input(env_name: &str, input_prompt: &str) -> String {
    std::env::var(env_name).unwrap_or_else(|_| {
        let api_key = input(input_prompt).interact().unwrap();
        std::env::set_var(env_name, &api_key);
        api_key
    })
}

pub fn get_user_input(message: &str, default_value: &str) -> std::io::Result<String> {
    input(message)
        .default_input(default_value)
        .interact()
}