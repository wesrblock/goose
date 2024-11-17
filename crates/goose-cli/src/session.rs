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
            .render(raw_message("Connected the developer system.\n"));

        self.prompt.goose_ready();

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
            loop {
                tokio::select! {
                    response = stream.next() => {
                        match response {
                            Some(Ok(message)) => {
                                messages.push(message.clone());
                                self.prompt.render(Box::new(message.clone()));
                            }
                            Some(Err(e)) => {
                                // TODO: Handle error display through prompt
                                eprintln!("Error: {}", e);
                                break;
                            }
                            None => break,
                        }
                    }
                    _ = tokio::signal::ctrl_c() => {
                        drop(stream);
                        // Pop all 'messages' from the assistant and the most recent user message. Resets the interaction to before the interrupted user request.
                        while let Some(message) = messages.pop() {
                            if message.role == goose::providers::types::message::Role::User {
                                break;
                            }
                            // else drop any assistant messages.
                        }

                        self.prompt.render(raw_message(" Interrupt: Resetting conversation to before the last sent message...\n"));
                        break;
                    }
                }
            }
            self.prompt.hide_busy();
        }
        self.prompt.close();
        Ok(())
    }
}

fn raw_message(content: &str) -> Box<Message> {
    Box::new(Message::assistant(content).unwrap())
}
