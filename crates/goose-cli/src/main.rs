mod commands {
    pub mod configure;
    pub mod expected_config;
    pub mod session;
    pub mod version;
}
mod inputs;
mod profile;
mod prompt;
mod session {
    pub mod session;
    pub mod session_file;
}
mod systems;

use anyhow::Result;
use clap::{Parser, Subcommand};
use commands::session::build_session;
use futures::StreamExt;

use crate::systems::system_handler::{add_system, remove_system};
use commands::configure::handle_configure;

use commands::version::print_version;

#[derive(Parser)]
#[command(author, about, long_about = None)]
struct Cli {
    /// Provider option (openai or databricks or ollama)
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
        #[arg(short, long)]
        session: Option<String>,
        #[arg(short, long)]
        profile: Option<String>,
        #[arg(short, long, action = clap::ArgAction::SetTrue)]
        resume: bool,
    },
    /// Run goose once-off with instructions from a file
    Run {
        #[arg(short, long)]
        instructions: Option<String>,
        #[arg(short, long)]
        profile: Option<String>,
        #[arg(short, long)]
        session: Option<String>,
        #[arg(short, long, action = clap::ArgAction::SetTrue)]
        resume: bool,
    },
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
    Ollama
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
        Some(Command::System { action }) => match action {
            SystemCommands::Add { url } => {
                add_system(url).await.unwrap();
                return Ok(());
            }
            SystemCommands::Remove { url } => {
                remove_system(url).await.unwrap();
                return Ok(());
            }
        },
        Some(Command::Session {
            session,
            profile,
            resume,
        }) => {
            let mut session = build_session(session, profile, resume);
            let _ = session.start().await;
            return Ok(());
        }
        Some(Command::Run {
            instructions,
            profile,
            session,
            resume,
        }) => {
            let file_name =
                instructions.expect("Instruction file is required (--instructions <file_path>)");
            let file_path = std::path::Path::new(&file_name);
            let contents = std::fs::read_to_string(file_path).expect("Failed to read the file");

            let mut session = build_session(session, profile, resume);
            let _ = session.headless_start(contents.clone()).await;
            return Ok(());
        }
        None => {
            println!("No command provided");
        }
    }
    Ok(())
}
