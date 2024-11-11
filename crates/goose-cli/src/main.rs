use anyhow::Result;
use bat::PrettyPrinter;
use clap::Parser;
use cliclack::{input, spinner};
use console::style;
use goose::providers::base::Provider;
use goose::providers::factory::{get_provider, ProviderType};
use serde_json::json;

use goose::providers::configs::OpenAiProviderConfig;
use goose::providers::configs::{DatabricksProviderConfig, ProviderConfig};
use goose::providers::types::content::Content;
use goose::providers::types::message::Message;
use goose::tool::Tool;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
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
}

#[derive(clap::ValueEnum, Clone, Debug)]
enum CliProviderVariant {
    OpenAi,
    Databricks,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    let provider = create_provider_from_cli(&cli);

    // Add word counting tool
    let parameters = json!({
        "type": "object",
        "properties": {
                "text": {
                    "type": "string",
                    "description": "The text to count words in"
                }
        },
        "required": ["text"]
    });
    let word_count_tool = Tool::new(
        "count_words",
        "Count the number of words in text",
        parameters,
    );

    let tools = vec![word_count_tool];

    println!(
        "Example goose CLI {}",
        style("- type \"exit\" to end the session").dim()
    );
    println!("\n");

    loop {
        let message_text: String = input("Message:").placeholder("").multiline().interact()?;

        if message_text.trim().eq_ignore_ascii_case("exit") {
            break;
        }

        let spin = spinner();
        spin.start("awaiting reply");

        // Create user message and get completion
        let user_message = Message::user(&message_text)?;
        let (response_message, _usage) = provider
            .complete(
                &cli.model,
                "You are a helpful assistant.",
                &[user_message],
                &tools, // Changed from &[] to &tools
                None,   // default temperature
                None,   // default max_tokens
            )
            .await?; // Added .await since complete returns a Future

        spin.stop("");

        if response_message.has_tool_request() {
            render(
                &Content::ToolRequest(response_message.tool_request().first().unwrap().clone())
                    .summary(),
            )
            .await;
        } else {
            render(&response_message.text()).await;
        }

        println!("\n");
    }
    Ok(())
}

async fn render(content: &str) {
    PrettyPrinter::new()
        .input_from_bytes(content.as_bytes())
        .language("markdown")
        .print()
        .unwrap();
}

fn create_provider_from_cli(cli: &Cli) -> Box<dyn Provider + Send + Sync> {
    match cli.provider {
        CliProviderVariant::OpenAi => {
            let openai_config = ProviderConfig::OpenAi(OpenAiProviderConfig {
                host: "https://api.openai.com".to_string(),
                api_key: cli.api_key.clone().unwrap_or_else(|| {
                    std::env::var("OPENAI_API_KEY").expect("OPENAI_API_KEY must be set")
                }),
            });
            get_provider(ProviderType::OpenAi, openai_config).unwrap()
        }
        CliProviderVariant::Databricks => {
            let databricks_config = ProviderConfig::Databricks(DatabricksProviderConfig {
                host: cli.databricks_host.clone().unwrap_or_else(|| {
                    std::env::var("DATABRICKS_HOST").expect("DATABRICKS_HOST must be set")
                }),
                token: cli.databricks_token.clone().unwrap_or_else(|| {
                    std::env::var("DATABRICKS_TOKEN").expect("DATABRICKS_TOKEN must be set")
                }),
            });
            get_provider(ProviderType::Databricks, databricks_config).unwrap()
        }
    }
}
