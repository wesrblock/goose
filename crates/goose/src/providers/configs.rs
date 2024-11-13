// Unified enum to wrap different provider configurations
pub enum ProviderConfig {
    OpenAi(OpenAiProviderConfig),
    Databricks(DatabricksProviderConfig),
}

// Define specific config structs for each provider
pub struct OpenAiProviderConfig {
    pub host: String,
    pub api_key: String,
    pub model: String,
    pub temperature: Option<f32>,
    pub max_tokens: Option<i32>,
}

pub struct DatabricksProviderConfig {
    pub host: String,
    pub token: String,
    pub model: String,
    pub temperature: Option<f32>,
    pub max_tokens: Option<i32>,
}

// Default implementations
impl Default for OpenAiProviderConfig {
    fn default() -> Self {
        Self {
            host: "https://api.openai.com".to_string(),
            api_key: String::new(),
            model: "gpt-4o".to_string(),
            temperature: None,
            max_tokens: None,
        }
    }
}

impl Default for DatabricksProviderConfig {
    fn default() -> Self {
        Self {
            host: "https://api.databricks.com".to_string(),
            token: String::new(),
            model: "gpt-4o".to_string(),
            temperature: None,
            max_tokens: None,
        }
    }
}
