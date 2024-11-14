mod commands {
    pub mod configure;
    pub mod session;
    pub mod version;
}

use anyhow::Result;
use clap::{Parser, Subcommand};
use cliclack::input;

use goose::agent::Agent;
use goose::providers::configs::OpenAiProviderConfig;
use goose::providers::configs::{DatabricksProviderConfig, ProviderConfig};
use goose::providers::factory;
use goose::providers::factory::ProviderType;

use commands::configure::{handle_configure, ConfigOptions};
use commands::session::Session;
use commands::version::print_version;

#[derive(Parser)]
#[command(author, about, long_about = None)]
struct Cli {
    /// Provider option (openai or databricks)
    #[arg(short, long, default_value = "open-ai")]
    #[arg(value_enum)]
    provider: CliProviderVariant,

    /// OpenAI API Key (can also be set via OPENAI_API_KEY environment variable)
    #[arg(long)]
    api_key: Option<String>,

    /// Databricks host (can also be set via DATABRICKS_HOST environment variable)
    #[arg(long)]
    databricks_host: Option<String>,

    /// Databricks token (can also be set via DATABRICKS_TOKEN environment variable)
    #[arg(long)]
    databricks_token: Option<String>,

    /// Model to use
    #[arg(short, long, default_value = "gpt-4o")]
    model: String,

    #[arg(short = 'v', long = "version")]
    version: bool,

    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Configure the provider and default systems
    Configure {
        /// Optional provider name; prompted if not provided
        #[arg(long)]
        provider: Option<String>,

        /// Optional host URL; prompted if not provided
        #[arg(long)]
        host: Option<String>,

        /// Optional token; prompted if not provided
        #[arg(long)]
        token: Option<String>,

        /// Optional processor; prompted if not provided
        #[arg(long)]
        processor: Option<String>,

        /// Optional accelerator; prompted if not provided
        #[arg(long)]
        accelerator: Option<String>,
    },
    /// Start or resume sessions with an optional session name
    Session {
        /// Optional session name
        session_name: Option<String>,
    },
    /// Run the main application
    Run,
}

#[derive(clap::ValueEnum, Clone, Debug)]
enum CliProviderVariant {
    OpenAi,
    Databricks,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    if cli.version {
        print_version();
        return Ok(());
    }

    match cli.command {
        Some(Command::Configure {
            provider,
            host,
            token,
            processor,
            accelerator,
        }) => {
            let options = ConfigOptions {
                provider,
                host,
                token,
                processor,
                accelerator,
            };
            let _ = handle_configure(options);
            return Ok(());
        }
        Some(Command::Session { session_name }) => {
            let session_name = session_name
                .unwrap_or_else(|| input("Session name:").placeholder("").interact().unwrap());
            println!("Session name: {}", session_name);

            // TODO: If no config exists, prompt the user through creating one.
            // TODO: Load the config from the file... Hard coding config for now.
            let provider_variant = CliProviderVariant::OpenAi;

            let provider_type = match provider_variant {
                CliProviderVariant::OpenAi => ProviderType::OpenAi,
                CliProviderVariant::Databricks => ProviderType::Databricks,
            };
            // TODO: use values already unloaded from cli for create_provider_config.
            // Also seems odd to have the cli prepping the provider rather than having that done in the agent?
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
            let provider =
                factory::get_provider(provider_type, create_provider_config(&cli_temp)).unwrap();
            let agent = Box::new(Agent::new(provider, cli_temp.model.clone()));
            let mut session = Session::new(agent);
            let _ = session.start().await;
            return Ok(());
        }
        Some(Command::Run) => {
            println!("Running the main application");
        }
        None => {
            println!("No command provided");
        }
    }
    Ok(())
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
