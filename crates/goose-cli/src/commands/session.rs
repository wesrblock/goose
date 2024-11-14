use crate::session::Session;
use crate::{Cli, CliProviderVariant};

use cliclack::input;

use goose::agent::Agent;
use goose::providers::configs::OpenAiProviderConfig;
use goose::providers::configs::{DatabricksProviderConfig, ProviderConfig};
use goose::providers::factory;
use goose::providers::factory::ProviderType;

pub fn build_session(session_name: Option<String>) -> Box<Session> {
    // TODO: Use session_name.
    let session_name =
        session_name.unwrap_or_else(|| input("Session name:").placeholder("").interact().unwrap());
    println!("TODO: Use session name: {}", session_name);

    // TODO: If no config exists, prompt the user through creating one.
    // TODO: Load the config from the file... Hard coding config for now.
    let provider_variant = CliProviderVariant::OpenAi;

    let provider_type = match provider_variant {
        CliProviderVariant::OpenAi => ProviderType::OpenAi,
        CliProviderVariant::Databricks => ProviderType::Databricks,
    };
    // TODO: use values already unloaded from cli for create_provider_config rather than passing cli.
    let processor = "gpt-4o-mini";
    let cli_temp = Cli {
        provider: provider_variant,
        api_key: None,
        databricks_host: None,
        databricks_token: None,
        model: processor.to_string(),
        version: false,
        command: None,
    };
    // TODO: Odd to be prepping the provider rather than having that done in the agent?
    let provider = factory::get_provider(provider_type, create_provider_config(&cli_temp)).unwrap();
    let agent = Box::new(Agent::new(provider, cli_temp.model.clone()));

    Box::new(Session::new(agent))
}

fn create_provider_config(cli: &Cli) -> ProviderConfig {
    match cli.provider {
        CliProviderVariant::OpenAi => ProviderConfig::OpenAi(OpenAiProviderConfig {
            host: "https://api.openai.com".to_string(),
            api_key: cli.api_key.clone().unwrap_or_else(|| {
                std::env::var("OPENAI_API_KEY").expect("OPENAI_API_KEY must be set")
            }),
        }),
        CliProviderVariant::Databricks => ProviderConfig::Databricks(DatabricksProviderConfig {
            host: cli.databricks_host.clone().unwrap_or_else(|| {
                std::env::var("DATABRICKS_HOST").expect("DATABRICKS_HOST must be set")
            }),
            token: cli.databricks_token.clone().unwrap_or_else(|| {
                std::env::var("DATABRICKS_TOKEN").expect("DATABRICKS_TOKEN must be set")
            }),
        }),
    }
}
