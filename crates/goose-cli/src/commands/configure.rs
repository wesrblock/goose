use crate::commands::expected_config::{get_recommended_models, RecommendedModels, DEFAULT_MODERATOR, DEFAULT_PROVIDER_NAME, DEFAULT_TOOLKIT_NAME};
use crate::profile::profile::{Profile, Toolkit};
use crate::profile::profile_handler::{find_existing_profile, profile_path, save_profile};
use cliclack::input;
use console::style;
use goose::providers::configs::{DatabricksProviderConfig, OpenAiProviderConfig, ProviderConfig};
use std::error::Error;

pub fn handle_configure(provided_profile_name: Option<String>) -> Result<(), Box<dyn Error>> {
    cliclack::intro(style(" configure-goose ").on_cyan().black())?;
    println!("We are helping you configure your Goose CLI profile.");
    let profile_name = provided_profile_name.unwrap_or_else(|| {
        get_input("Enter profile name:", "default").unwrap()
    } );
    let existing_profile_result = find_existing_profile(profile_name.as_str());
    if existing_profile_result.is_some() {
        println!("Profile already exists. We are going to overwriting the existing profile...");
    } else {
        println!("We are creating a new profile...");
    }
    let existing_profile = existing_profile_result.as_ref();
    let provider_name = get_input("Enter provider name:", DEFAULT_PROVIDER_NAME)?;
    set_provider_config(&provider_name);
    let recommended_models = get_recommended_models(&provider_name);
    let processor = set_processor(existing_profile, &recommended_models)?;
    let accelerator = set_accelerator(existing_profile, &recommended_models)?;
    let moderator = set_moderator(existing_profile)?;
    let toolkit = set_toolkits(existing_profile)?;
    let profile = Profile {
        provider: provider_name,
        processor,
        accelerator,
        moderator,
        toolkits: vec![toolkit],
    };
    match save_profile(profile_name.as_str(), profile) {
        Ok(()) => println!("\nProfile saved to: {:?}", profile_path()?),
        Err(e) => println!("Failed to save profile: {}", e),
    }
    Ok(())
}

fn set_toolkits(existing_profile: Option<&Profile>) -> Result<Toolkit, Box<dyn Error>> {
    // TODO: Add support for multiple toolkits
    let default_toolkit_name = existing_profile
        .map_or(DEFAULT_TOOLKIT_NAME, |profile| profile.toolkits[0].name.as_str());
    let toolkit_name: String = get_input("Enter toolkit:", default_toolkit_name)?;
    let toolkit = Toolkit {
        name: toolkit_name,
        requires: std::collections::HashMap::new(),
    };
    Ok(toolkit)
}

fn set_processor(existing_profile: Option<&Profile>, recommended_models: &RecommendedModels) -> Result<String, Box<dyn Error>> {
    let default_processor_value = existing_profile
        .map_or(recommended_models.processor, |profile| profile.processor.as_str());
    let processor = get_input("Enter processor:", default_processor_value)?;
    Ok(processor)
}

fn set_accelerator(existing_profile: Option<&Profile>, recommended_models: &RecommendedModels) -> Result<String, Box<dyn Error>> {
    let default_ccelerator_value = existing_profile
        .map_or(recommended_models.accelerator, |profile| profile.accelerator.as_str());
    let processor = get_input("Enter accelerator:", default_ccelerator_value)?;
    Ok(processor)
}

fn set_moderator(existing_profile: Option<&Profile>) -> Result<String, Box<dyn Error>> {
    let default_moderator_value = existing_profile
        .map_or(DEFAULT_MODERATOR, |profile| profile.moderator.as_str());
    let moderator = get_input("Enter moderator:", default_moderator_value)?;
    Ok(moderator)
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
