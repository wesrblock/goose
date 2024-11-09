use super::base::ProviderConfig;
use anyhow::Result;

pub struct OpenAiProviderConfig {
    pub api_key: String,
    pub host: String,
}

impl OpenAiProviderConfig {
    pub fn new(api_key: String, host: String) -> Self {
        Self { api_key, host }
    }
}

impl ProviderConfig for OpenAiProviderConfig {
    fn from_env() -> Result<Self> {
        let api_key = Self::get_env("OPENAI_API_KEY", true, None)?
            .ok_or_else(|| anyhow::anyhow!("OpenAI API key should be present"))?;

        let host = Self::get_env(
            "OPENAI_API_HOST",
            false,
            Some("https://api.openai.com/".to_string()),
        )?
        .unwrap_or_else(|| "https://api.openai.com/".to_string());

        Ok(Self::new(api_key, host))
    }
}
