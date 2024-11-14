use crate::commands::expected_config::{get_recommended_models, DEFAULT_MODERATOR, DEFAULT_TOOLKIT_NAME};
use crate::profile::profile::{Profile, Toolkit};
use crate::profile::profile_handler::{create_profile, profile_path};
use cliclack::input;
use console::style;
use goose::providers::configs::{DatabricksProviderConfig, OpenAiProviderConfig, ProviderConfig};
use std::error::Error;

pub fn handle_configure() -> Result<(), Box<dyn Error>> {
    cliclack::intro(style(" configure-goose ").on_cyan().black())?;
    let provider_name = get_input("Enter provider name:", "openai")?;
    set_provider_config(&provider_name);
    let recommended_models = get_recommended_models(&provider_name);
    let processor = get_input("Enter processor:", recommended_models.processor)?;
    let accelerator = get_input("Enter accelerator:", recommended_models.accelerator)?;
    let moderator = get_input("Enter moderator:", DEFAULT_MODERATOR)?;

    // TODO: Add support for multiple toolkits
    let toolkit_name: String = get_input("Enter toolkit:", DEFAULT_TOOLKIT_NAME)?;
    let toolkit = Toolkit {
        name: toolkit_name,
        requires: std::collections::HashMap::new(),
    };
    let profile = Profile {
        provider: provider_name,
        processor,
        accelerator,
        moderator,
        toolkits: vec![toolkit],
    };
    match create_profile("default", &profile) {
        Ok(()) => println!("\nConfiguration saved to: {:?}", profile_path()?),
        Err(e) => println!("Failed to save configuration: {}", e),
    }
    Ok(())
}

fn get_input(message: &str, default_value: &str) -> std::io::Result<String> {
    input(message)
        .default_input(default_value)
        .interact()
}

fn set_provider_config(provider_name: &str) -> ProviderConfig {
    match provider_name.to_lowercase().as_str() {
        "openai" => ProviderConfig::OpenAi(OpenAiProviderConfig {
            host: "https://api.openai.com".to_string(),
            api_key: get_env_value_or_input("OPENAI_API_KEY", "Please enter your OpenAI API key:"),
        }),
        "databricks" => ProviderConfig::Databricks(DatabricksProviderConfig {
            host: get_env_value_or_input("DATABRICKS_HOST", "Please enter your Databricks host:"),
            token: get_env_value_or_input("DATABRICKS_TOKEN", "Please enter your Databricks token:")
        }),
        _ => panic!("Invalid provider name"),
    }
}

fn get_env_value_or_input(env_name: &str, input_prompt: &str) -> String {
    std::env::var(env_name).unwrap_or_else(|_| {
        let api_key = input(input_prompt).interact().unwrap();
        std::env::set_var(env_name, &api_key);
        api_key
    })
}
