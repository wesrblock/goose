// Unified enum to wrap different provider configurations
pub enum ProviderConfig {
    OpenAi(OpenAiProviderConfig),
    Databricks(DatabricksProviderConfig),
}

// Define specific config structs for each provider
pub struct OpenAiProviderConfig {
    pub host: String,
    pub api_key: String,
}

pub struct DatabricksProviderConfig {
    pub host: String,
    pub token: String,
}
