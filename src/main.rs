use anyhow::{Context, Result};
use bat::PrettyPrinter;
use clap::Parser;
use cliclack::{input, spinner};
use console::style;
use reqwest::Client;
use serde_json::{json, Value};
use std::env;

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

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Get API key from command line or environment variable
    let api_key = cli
        .api_key
        .or_else(|| env::var("OPENAI_API_KEY").ok())
        .context("API key must be provided via --api-key or OPENAI_API_KEY environment variable")?;

    let client = Client::new();
    println!(
        "Example goose CLI {}",
        style("- type \"exit\" to end the session").dim()
    );
    println!("\n");

    loop {
        let message: String = input("Message:").placeholder("").multiline().interact()?;

        if message.trim().eq_ignore_ascii_case("exit") {
            break;
        }

        let future = send_chat_request(&client, &api_key, &cli.model, &message);
        let spin = spinner();
        spin.start("awaiting reply");

        let response = future.await?;
        spin.stop("");

        // Extract the content from the response
        let content = response["choices"][0]["message"]["content"]
            .as_str()
            .context("Failed to get response content")?;

        render(content).await;
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

async fn send_chat_request(
    client: &Client,
    api_key: &str,
    model: &str,
    message: &str,
) -> Result<Value> {
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&json!({
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": message
                }
            ]
        }))
        .send()
        .await?
        .json::<Value>()
        .await?;

    Ok(response)
}
