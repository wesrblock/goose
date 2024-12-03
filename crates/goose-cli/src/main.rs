mod commands {
    pub mod configure;
    pub mod expected_config;
    pub mod session;
    pub mod version;
}
pub mod agents;
mod inputs;
mod profile;
mod prompt;
pub mod session;

mod systems;
mod key_handler;

use anyhow::Result;
use clap::{Parser, Subcommand};
use commands::configure::handle_configure;
use commands::session::build_session;
use commands::version::print_version;
use profile::has_no_profiles;
use std::io::{self, Read};

use crate::systems::system_handler::{add_system, remove_system};

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

    /// The machine learning model to use for operations. Use 'gpt-4o' for enhanced competence.
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
    /// Configure Goose settings and profiles
    #[command(about = "Configure Goose settings and profiles")]
    Configure {
        /// Name of the profile to configure
        #[arg(
            help = "Profile name to configure",
            long_help = "Create or modify a named configuration profile. Use 'default' for the default profile."
        )]
        profile_name: Option<String>,
    },

    /// Manage system prompts and behaviors
    #[command(about = "Manage system prompts and behaviors")]
    System {
        #[command(subcommand)]
        action: SystemCommands,
    },

    /// Start or resume interactive chat sessions
    #[command(
        about = "Start or resume interactive chat sessions",
        alias = "s",
    )]
    Session {
        /// Name for the chat session
        #[arg(
            short,
            long,
            value_name = "NAME",
            help = "Name for the chat session (e.g., 'project-x')",
            long_help = "Specify a name for your chat session. When used with --resume, will resume this specific session if it exists."
        )]
        session: Option<String>,

        /// Configuration profile to use
        #[arg(
            short,
            long,
            value_name = "PROFILE",
            help = "Configuration profile to use (e.g., 'default')",
            long_help = "Use a specific configuration profile. Profiles contain settings like API keys and model preferences."
        )]
        profile: Option<String>,

        /// Resume a previous session
        #[arg(
            short,
            long,
            help = "Resume a previous session (last used or specified by --session)",
            long_help = "Continue from a previous chat session. If --session is provided, resumes that specific session. Otherwise resumes the last used session."
        )]
        resume: bool,
    },

    /// Execute commands from an instruction file
    #[command(about = "Execute commands from an instruction file")]
    Run {
        /// Path to instruction file containing commands
        #[arg(
            short,
            long,
            required = true,
            value_name = "FILE",
            help = "Path to instruction file containing commands",
        )]
        instructions: Option<String>,

        /// Configuration profile to use
        #[arg(
            short,
            long,
            value_name = "PROFILE",
            help = "Configuration profile to use (e.g., 'default')",
            long_help = "Use a specific configuration profile. Profiles contain settings like API keys and model preferences."
        )]
        profile: Option<String>,

        /// Input text containing commands
        #[arg(
          short = 't',
          long = "text",
          value_name = "TEXT",
          help = "Input text to provide to Goose directly",
          long_help = "Input text containing commands for Goose. Use this in lieu of the instructions argument."
        )]
        input_text: Option<String>,

        /// Name for this run session
        #[arg(
            short,
            long,
            value_name = "NAME",
            help = "Name for this run session (e.g., 'daily-tasks')",
            long_help = "Specify a name for this run session. This helps identify and resume specific runs later."
        )]
        session: Option<String>,

        /// Resume a previous run
        #[arg(
            short,
            long,
            action = clap::ArgAction::SetTrue,
            help = "Resume from a previous run",
            long_help = "Continue from a previous run, maintaining the execution state and context."
        )]
        resume: bool,
    },
}

#[derive(Subcommand)]
enum SystemCommands {
    /// Add a new system prompt
    #[command(about = "Add a new system prompt from URL")]
    Add {
        #[arg(
            help = "URL of the system prompt to add",
            long_help = "URL pointing to a file containing the system prompt to be added."
        )]
        url: String,
    },

    /// Remove an existing system prompt
    #[command(about = "Remove an existing system prompt")]
    Remove {
        #[arg(
            help = "URL of the system prompt to remove",
            long_help = "URL of the system prompt that should be removed from the configuration."
        )]
        url: String,
    },
}

#[derive(clap::ValueEnum, Clone, Debug)]
enum CliProviderVariant {
    OpenAi,
    Databricks,
    Ollama,
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
            input_text,
            profile,
            session,
            resume,
        }) => {
            let contents = if let Some(file_name) = instructions {
                let file_path = std::path::Path::new(&file_name);
                std::fs::read_to_string(file_path).expect("Failed to read the instruction file")
            } else if let Some(input_text) = input_text {
                input_text
            } else {
                let mut stdin = String::new();
                io::stdin()
                    .read_to_string(&mut stdin)
                    .expect("Failed to read from stdin");
                stdin
            };
            let mut session = build_session(session, profile, resume);
            let _ = session.headless_start(contents.clone()).await;
            return Ok(());
        }
        None => {
            println!("No command provided - Run 'goose help' to see available commands.");
            if has_no_profiles().unwrap_or(false) {
                println!("\nRun 'goose configure' to setup goose for the first time.");
            }
        }
    }
    Ok(())
}
