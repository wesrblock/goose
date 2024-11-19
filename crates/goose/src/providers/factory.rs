use super::{
    base::Provider, configs::ProviderConfig, databricks::DatabricksProvider, openai::OpenAiProvider,
};
use anyhow::Result;
use strum_macros::EnumIter;

#[derive(EnumIter, Debug)]
pub enum ProviderType {
    OpenAi,
    Databricks,
}

pub fn get_provider(config: ProviderConfig) -> Result<Box<dyn Provider + Send + Sync>> {
    match config {
        ProviderConfig::OpenAi(openai_config) => Ok(Box::new(OpenAiProvider::new(openai_config)?)),
        ProviderConfig::Databricks(databricks_config) => {
            Ok(Box::new(DatabricksProvider::new(databricks_config)?))
        }
    }
}
