mod commands {
    pub mod configure;
    pub mod expected_config;
    pub mod session;
    pub mod version;
}
mod inputs;
mod profile;
mod prompt;
mod session;
mod systems;

use anyhow::Result;
use clap::{Parser, Subcommand};

use commands::configure::handle_configure;
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

    /// Temperature (0.0 to 1.0)
    #[arg(short, long)]
    temperature: Option<f32>,

    /// Maximum tokens to generate
    #[arg(long)]
    max_tokens: Option<i32>,

    #[arg(short = 'v', long = "version")]
    version: bool,

    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    Configure {
        profile_name: Option<String>,
    },
    System {
        #[command(subcommand)]
        action: SystemCommands,
    },
    /// Start or resume sessions with an optional session name
    Session {
        session: Option<String>,
        profile: Option<String>,
    },
    /// Run the main application
    Run,
}

#[derive(Subcommand)]
enum SystemCommands {
    Add {
        #[arg(help = "The URL to add system")]
        url: String,
    },
    Remove {
        #[arg(help = "The URL to remove system")]
        url: String,
    },
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
        Some(Command::Configure { profile_name }) => {
            let _ = handle_configure(profile_name).await;
            return Ok(());
        }
        Some(Command::System { action }) => {
            match action {
                SystemCommands::Add { url } => {
                    println!("Adding system: {}", url);
                }
                SystemCommands::Remove { url } => {
                    println!("Removing system: {}", url);
                }
            }
        }
        Some(Command::Session { session, profile }) => {
            let mut session = build_session(session, profile);
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
