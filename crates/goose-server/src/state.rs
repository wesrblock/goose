use goose::providers::configs::ProviderConfig;

/// Shared application state
pub struct AppState {
    pub provider_config: ProviderConfig,
}

// Manual Clone implementation since we know ProviderConfig variants can be cloned
impl Clone for AppState {
    fn clone(&self) -> Self {
        Self {
            provider_config: match &self.provider_config {
                ProviderConfig::OpenAi(config) => {
                    ProviderConfig::OpenAi(goose::providers::configs::OpenAiProviderConfig {
                        host: config.host.clone(),
                        api_key: config.api_key.clone(),
                        model: config.model.clone(),
                        temperature: config.temperature,
                        max_tokens: config.max_tokens,
                    })
                }
                ProviderConfig::Databricks(config) => ProviderConfig::Databricks(
                    goose::providers::configs::DatabricksProviderConfig {
                        host: config.host.clone(),
                        auth: config.auth.clone(),
                        model: config.model.clone(),
                        temperature: config.temperature,
                        max_tokens: config.max_tokens,
                    },
                ),
                ProviderConfig::Ollama(config) => ProviderConfig::Ollama(
                    goose::providers::configs::OllamaProviderConfig {
                        host: config.host.clone(),
                        model: config.model.clone(),
                        temperature: config.temperature,
                        max_tokens: config.max_tokens,
                    },
                ),
            },
        }
    }
}