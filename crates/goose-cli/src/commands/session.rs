use crate::session::Session;
use crate::{Cli, CliProviderVariant};

use cliclack::input;

use goose::agent::Agent;
use goose::providers::configs::OpenAiProviderConfig;
use goose::providers::configs::{DatabricksProviderConfig, ProviderConfig};
use goose::providers::factory;
use goose::providers::factory::ProviderType;

use crate::prompt::CliclackPrompt;

use super::configure::ConfigOptions;

pub fn build_session<'a>(
    session_name: Option<String>,
    config_options: Box<ConfigOptions>,
) -> Box<Session<'a>> {
    // TODO: Use session_name.
    let session_name =
        session_name.unwrap_or_else(|| input("Session name:").placeholder("").interact().unwrap());
    println!("TODO: Use session name: {}", session_name);

    // TODO: Config should be passed through from main... Hard coding config for now if missing for iterating.
    let model = config_options
        .accelerator
        .unwrap_or_else(|| "gpt-4o".to_string());
    let provider_type = match config_options.provider.as_deref() {
        Some("open-ai") => ProviderType::OpenAi,
        Some("databricks") => ProviderType::Databricks,
        _ => {
            println!("No provider specified, defaulting to OpenAI");
            ProviderType::OpenAi
        } // _ => panic!("Unknown provider type"),
    };
    let provider_variant = match provider_type {
        ProviderType::OpenAi => CliProviderVariant::OpenAi,
        ProviderType::Databricks => CliProviderVariant::Databricks,
    };

    // TODO: Load from config instead of hard coding.
    let cli_temp = Cli {
        provider: provider_variant,
        api_key: None,
        databricks_host: None,
        databricks_token: None,
        model: model,
        version: false,
        command: None,
        temperature: None,
        max_tokens: None,
    };
    // TODO: Odd to be prepping the provider rather than having that done in the agent?
    let provider = factory::get_provider(provider_type, create_provider_config(&cli_temp)).unwrap();
    let agent = Box::new(Agent::new(provider));
    let prompt = Box::new(CliclackPrompt::new());

    Box::new(Session::new(agent, prompt))
}

fn create_provider_config(cli: &Cli) -> ProviderConfig {
    match cli.provider {
        CliProviderVariant::OpenAi => ProviderConfig::OpenAi(OpenAiProviderConfig {
            host: "https://api.openai.com".to_string(),
            api_key: cli.api_key.clone().unwrap_or_else(|| {
                std::env::var("OPENAI_API_KEY").expect("OPENAI_API_KEY must be set")
            }),
            model: cli.model.clone(),
            temperature: cli.temperature,
            max_tokens: cli.max_tokens,
        }),
        CliProviderVariant::Databricks => ProviderConfig::Databricks(DatabricksProviderConfig {
            host: cli.databricks_host.clone().unwrap_or_else(|| {
                std::env::var("DATABRICKS_HOST").expect("DATABRICKS_HOST must be set")
            }),
            token: cli.databricks_token.clone().unwrap_or_else(|| {
                std::env::var("DATABRICKS_TOKEN").expect("DATABRICKS_TOKEN must be set")
            }),
            model: cli.model.clone(),
            temperature: cli.temperature,
            max_tokens: cli.max_tokens,
        }),
    }
}
