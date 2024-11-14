use anyhow::Result;
use bat::PrettyPrinter;
use cliclack::{input, spinner};
use futures::StreamExt;

use goose::agent::Agent;
use goose::developer::DeveloperSystem;
use goose::providers::types::message::Message;

pub struct Session {
    agent: Box<Agent>,
}

impl Session {
    pub fn new(agent: Box<Agent>) -> Self {
        Session { agent }
    }

    pub async fn start(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        println!("Starting session...");

        let system = Box::new(DeveloperSystem::new());
        self.agent.add_system(system);
        println!("Connected the developer system");

        let mut messages = Vec::new();

        loop {
            let message_text: String = input("Message:").placeholder("").multiline().interact()?;
            if message_text.trim().eq_ignore_ascii_case("exit") {
                break;
            }
            messages.push(Message::user(&message_text).unwrap());

            let spin = spinner();
            spin.start("awaiting reply");

            // Process the stream of messages
            let mut stream = self.agent.reply(&messages);
            while let Some(response) = stream.next().await {
                match response {
                    Ok(message) => {
                        messages.push(message.clone());
                        for content in &message.content {
                            render(&content.summary()).await;
                        }
                    }
                    Err(e) => {
                        eprintln!("Error: {}", e);
                        break;
                    }
                }
            }
            spin.stop("");

            println!("\n");
        }
        Ok(())
    }
}

// TODO: async???
async fn render(content: &str) {
    PrettyPrinter::new()
        .input_from_bytes(content.as_bytes())
        .language("markdown")
        .print()
        .unwrap();
}
