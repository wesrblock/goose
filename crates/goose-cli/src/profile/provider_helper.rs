use crate::inputs::inputs::get_env_value_or_input;
use goose::providers::configs::{
    DatabricksAuth, DatabricksProviderConfig, OpenAiProviderConfig, OllamaProviderConfig, ProviderConfig
};
use goose::providers::factory::ProviderType;
use goose::providers::ollama::OLLAMA_HOST;
use strum::IntoEnumIterator;

pub const PROVIDER_OPEN_AI: &str = "openai";
pub const PROVIDER_DATABRICKS: &str = "databricks";
pub const PROVIDER_OLLAMA: &str = "ollama";

pub fn select_provider_lists() -> Vec<(&'static str, String, &'static str)> {
    ProviderType::iter()
        .map(|provider| match provider {
            ProviderType::OpenAi => (
                PROVIDER_OPEN_AI,
                PROVIDER_OPEN_AI.to_string(),
                "Recommended",
            ),
            ProviderType::Databricks => (PROVIDER_DATABRICKS, PROVIDER_DATABRICKS.to_string(), ""),
            ProviderType::Ollama => (PROVIDER_OLLAMA, PROVIDER_OLLAMA.to_string(), "")
        })
        .collect()
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
            host: std::env::var("OLLAMA_HOST")
                .unwrap_or_else(|_| String::from(OLLAMA_HOST)),
            model,
            temperature: None,
            max_tokens: None,
        }),
        _ => panic!("Invalid provider name"),
    }
}
