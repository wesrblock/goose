use std::env;
use anyhow::Result;

pub trait ProviderConfig {
    /// Load configuration from environment variables
    fn from_env() -> Result<Self>
    where
        Self: Sized;

    /// Helper function to get environment variables with error handling
    fn get_env(key: &str, required: bool, default: Option<String>) -> Result<Option<String>> {
        match env::var(key) {
            Ok(value) => Ok(Some(value)),
            Err(env::VarError::NotPresent) if !required => Ok(default),
            Err(env::VarError::NotPresent) => Err(anyhow::anyhow!("Environment variable '{}' is required but not set.", key)),
            Err(e) => Err(e.into()),
        }
    }
}
