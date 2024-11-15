mod commands {
    pub mod configure;
    pub mod session;
    pub mod version;
}
mod session;

use anyhow::Result;
use clap::{Parser, Subcommand};

use commands::configure::{handle_configure, ConfigOptions};
use commands::session::build_session;
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
            // TODO: If no profile is provided then dynamically prepare it
            let options = ConfigOptions {
                provider: None,
                host: None,
                token: None,
                processor: None,
                accelerator: None,
            };
            // let config_options = handle_configure(options).unwrap();
            let config_options = Box::new(options);
            let mut session = build_session(session_name, config_options);
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
