use super::{
    base::Provider, configs::ProviderConfig, databricks::DatabricksProvider, openai::OpenAiProvider,
};
use anyhow::Error;

pub enum ProviderType {
    OpenAi,
    Databricks,
}

pub fn get_provider(
    provider_type: ProviderType,
    config: ProviderConfig,
) -> Result<Box<dyn Provider + Send + Sync>, Error> {
    match (provider_type, config) {
        (ProviderType::OpenAi, ProviderConfig::OpenAi(openai_config)) => {
            Ok(Box::new(OpenAiProvider::new(openai_config)?))
        }
        (ProviderType::Databricks, ProviderConfig::Databricks(databricks_config)) => {
            Ok(Box::new(DatabricksProvider::new(databricks_config)?))
        }
        _ => Err(Error::msg("Provider type and config mismatch")),
    }
}
