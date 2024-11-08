use anyhow::{Context, Result};
use bat::PrettyPrinter;
use clap::Parser;
use cliclack::{input, spinner};
use console::style;
use std::env;

use goose::providers::configs::openai::OpenAiProviderConfig;
use goose::providers::base::Provider;
use goose::providers::openai::OpenAiProvider;
use goose::providers::types::message::Message;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Cli {
    /// OpenAI API Key (can also be set via OPENAI_API_KEY environment variable)
    #[arg(short, long)]
    api_key: Option<String>,

    /// Model to use
    #[arg(short, long, default_value = "gpt-4o")]
    model: String,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    // Get API key from command line or environment variable
    let api_key = cli
        .api_key
        .or_else(|| env::var("OPENAI_API_KEY").ok())
        .context("API key must be provided via --api-key or OPENAI_API_KEY environment variable")?;

    // Initialize OpenAI provider
    let provider = OpenAiProvider::new(OpenAiProviderConfig {
        api_key,
        host: "https://api.openai.com".to_string(),
    })?;

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
        let (response_message, _usage) = provider.complete(
            &cli.model,
            "You are a helpful assistant.",
            &[user_message],
            &[],  // no tools
            None, // default temperature
            None, // default max_tokens
            None, // no stop sequences
            None, // default top_p
        )?;

        spin.stop("");

        render(&response_message.text());
        println!("\n");
    }
    Ok(())
}

fn render(content: &str) {
    PrettyPrinter::new()
        .input_from_bytes(content.as_bytes())
        .language("markdown")
        .print()
        .unwrap();
}
