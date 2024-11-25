use std::collections::HashMap;
use std::error::Error;
use std::fs;
use std::path::PathBuf;

use crate::inputs::get_env_value_or_input;
use goose::providers::configs::{
    DatabricksAuth, DatabricksProviderConfig, OllamaProviderConfig, OpenAiProviderConfig,
    ProviderConfig,
};
use goose::providers::factory::ProviderType;
use goose::providers::ollama::OLLAMA_HOST;
use serde::{Deserialize, Serialize};
use strum::IntoEnumIterator;

// Profile types and structures
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Profile {
    pub provider: String,
    pub model: String,
    #[serde(default)]
    pub additional_systems: Vec<AdditionalSystem>,
}

#[derive(Serialize, Deserialize)]
pub struct Profiles {
    pub profile_items: HashMap<String, Profile>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AdditionalSystem {
    pub name: String,
    pub location: String,
}

// Provider helper constants and functions
pub const PROVIDER_OPEN_AI: &str = "openai";
pub const PROVIDER_DATABRICKS: &str = "databricks";
pub const PROVIDER_OLLAMA: &str = "ollama";
pub const PROFILE_DEFAULT_NAME: &str = "default";

pub fn select_provider_lists() -> Vec<(&'static str, String, &'static str)> {
    ProviderType::iter()
        .map(|provider| match provider {
            ProviderType::OpenAi => (
                PROVIDER_OPEN_AI,
                PROVIDER_OPEN_AI.to_string(),
                "Recommended",
            ),
            ProviderType::Databricks => (PROVIDER_DATABRICKS, PROVIDER_DATABRICKS.to_string(), ""),
            ProviderType::Ollama => (PROVIDER_OLLAMA, PROVIDER_OLLAMA.to_string(), ""),
        })
        .collect()
}

pub fn profile_path() -> Result<PathBuf, Box<dyn Error>> {
    let home_dir = dirs::home_dir().ok_or(anyhow::anyhow!("Could not determine home directory"))?;
    let config_dir = home_dir.join(".config").join("goose");
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)?;
    }
    Ok(config_dir.join("profiles.json"))
}

pub fn load_profiles() -> Result<HashMap<String, Profile>, Box<dyn Error>> {
    let path = profile_path()?;
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let content = fs::read_to_string(path)?;
    let profiles: Profiles = serde_json::from_str(&content)?;
    Ok(profiles.profile_items)
}

pub fn save_profile(name: &str, profile: Profile) -> Result<(), Box<dyn Error>> {
    let path = profile_path()?;
    let mut profiles = load_profiles()?;
    profiles.insert(name.to_string(), profile);
    let profiles = Profiles {
        profile_items: profiles,
    };
    let content = serde_json::to_string_pretty(&profiles)?;
    fs::write(path, content)?;
    Ok(())
}

pub fn find_existing_profile(name: &str) -> Option<Profile> {
    match load_profiles() {
        Ok(profiles) => profiles.get(name).cloned(),
        Err(_) => None,
    }
}

pub fn set_provider_config(provider_name: &str, model: String) -> ProviderConfig {
    match provider_name.to_lowercase().as_str() {
        PROVIDER_OPEN_AI => ProviderConfig::OpenAi(OpenAiProviderConfig {
            host: "https://api.openai.com".to_string(),
            api_key: get_env_value_or_input(
                "OPENAI_API_KEY",
                "Please enter your OpenAI API key:",
                true,
            ),
            model,
            temperature: None,
            max_tokens: None,
        }),
        PROVIDER_DATABRICKS => {
            let host = get_env_value_or_input(
                "DATABRICKS_HOST",
                "Please enter your Databricks host:",
                false,
            );
            ProviderConfig::Databricks(DatabricksProviderConfig {
                host: host.clone(),
                // TODO revisit configuration
                auth: DatabricksAuth::oauth(host),
                model,
                temperature: None,
                max_tokens: None,
                image_format: goose::providers::utils::ImageFormat::Anthropic,
            })
        }
        PROVIDER_OLLAMA => ProviderConfig::Ollama(OllamaProviderConfig {
            host: std::env::var("OLLAMA_HOST").unwrap_or_else(|_| String::from(OLLAMA_HOST)),
            model,
            temperature: None,
            max_tokens: None,
        }),
        _ => panic!("Invalid provider name"),
    }
}
