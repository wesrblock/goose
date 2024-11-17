use anyhow::Result;
use futures::StreamExt;

use crate::prompt::InputType;
use crate::prompt::Prompt;

use goose::agent::Agent;
use goose::developer::DeveloperSystem;
use goose::providers::types::message::Message;

pub struct Session<'a> {
    agent: Box<Agent>,
    prompt: Box<dyn Prompt + 'a>,
}

impl<'a> Session<'a> {
    pub fn new(agent: Box<Agent>, prompt: Box<impl Prompt + 'a>) -> Self {
        Session { agent, prompt }
    }

    pub async fn start(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.prompt.render(raw_message("Starting session...\n"));

        let system = Box::new(DeveloperSystem::new());
        self.agent.add_system(system);
        self.prompt
            .render(raw_message("Connected the developer system\n"));

        let mut messages = Vec::new();

        loop {
            let input = self.prompt.get_input().unwrap();
            match input.input_type {
                InputType::Exit => break,
                InputType::Message => {
                    if let Some(content) = &input.content {
                        messages.push(Message::user(content).unwrap());
                    }
                }
            }

            self.prompt.show_busy();

            // Process the stream of messages
            let mut stream = self.agent.reply(&messages);
            while let Some(response) = stream.next().await {
                match response {
                    Ok(message) => {
                        messages.push(message.clone());
                        self.prompt.render(Box::new(message.clone()));
                    }
                    Err(e) => {
                        // TODO: Handle error display through prompt
                        eprintln!("Error: {}", e);
                        break;
                    }
                }
            }
            self.prompt.hide_busy();

            self.prompt.render(raw_message("\n"));
        }
        self.prompt.close();
        Ok(())
    }
}

fn raw_message(content: &str) -> Box<Message> {
    Box::new(Message::assistant(content).unwrap())
}
