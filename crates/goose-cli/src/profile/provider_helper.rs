use goose::providers::factory::ProviderType;
use strum::IntoEnumIterator;
use goose::providers::configs::{DatabricksProviderConfig, OpenAiProviderConfig, ProviderConfig};
use crate::inputs::inputs::get_env_value_or_input;

pub const PROVIDER_OPEN_AI: &str = "openai";
pub const PROVIDER_DATABRICKS: &str = "databricks";

pub fn select_provider_lists() -> Vec<(&'static str, String, &'static str)> {
    ProviderType::iter()
        .map(|provider| {
            match provider {
                ProviderType::OpenAi => (PROVIDER_OPEN_AI, PROVIDER_OPEN_AI.to_string(), "Recommended"),
                ProviderType::Databricks => (PROVIDER_DATABRICKS, PROVIDER_DATABRICKS.to_string(), ""),
            }
        }).collect()
}

pub fn set_provider_config(provider_name: &str) -> ProviderConfig {
    match provider_name.to_lowercase().as_str() {
        PROVIDER_OPEN_AI => ProviderConfig::OpenAi(OpenAiProviderConfig {
            host: "https://api.openai.com".to_string(),
            api_key: get_env_value_or_input("OPENAI_API_KEY", "Please enter your OpenAI API key:"),
        }),
        PROVIDER_DATABRICKS => ProviderConfig::Databricks(DatabricksProviderConfig {
            host: get_env_value_or_input("DATABRICKS_HOST", "Please enter your Databricks host:"),
            token: get_env_value_or_input("DATABRICKS_TOKEN", "Please enter your Databricks token:")
        }),
        _ => panic!("Invalid provider name"),
    }
}

pub fn get_provider_type(provider_name: &str) -> ProviderType {
    match provider_name.to_lowercase().as_str() {
        PROVIDER_OPEN_AI => ProviderType::OpenAi,
        PROVIDER_DATABRICKS => ProviderType::Databricks,
        _ => panic!("Invalid provider name"),
    }
}