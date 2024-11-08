use super::base::ProviderConfig;
use anyhow::Result;

pub struct DatabricksProviderConfig {
    pub host: String,
    pub token: String,
}

impl DatabricksProviderConfig {
    pub fn new(host: String, token: String) -> Self {
        Self { host, token }
    }


}

impl ProviderConfig for DatabricksProviderConfig {
    fn from_env() -> Result<Self> {
        // Get required host
        let host = Self::get_env("DATABRICKS_HOST", true, None)?
            .ok_or_else(|| anyhow::anyhow!("Databricks host should be present"))?;

        // Get required token
        let token = Self::get_env("DATABRICKS_TOKEN", true, None)?
            .ok_or_else(|| anyhow::anyhow!("Databricks token should be present"))?;

        Ok(Self::new(host, token))
    }
}
