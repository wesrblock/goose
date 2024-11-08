use std::env;

pub trait ProviderConfig {
    /// Load configuration from environment variables
    fn from_env() -> Result<Self, Box<dyn std::error::Error>>
    where
        Self: Sized;

    /// Helper function to get environment variables with error handling
    fn get_env(key: &str, required: bool, default: Option<String>) -> Result<Option<String>, Box<dyn std::error::Error>> {
        match env::var(key) {
            Ok(value) => Ok(Some(value)),
            Err(env::VarError::NotPresent) if !required => Ok(default),
            Err(env::VarError::NotPresent) => Err(format!("Environment variable '{}' is required but not set.", key).into()),
            Err(e) => Err(Box::new(e)),
        }
    }
}
