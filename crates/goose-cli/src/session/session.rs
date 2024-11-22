use anyhow::Result;
use futures::StreamExt;
use std::path::PathBuf;

use crate::prompt::prompt::{InputType, Prompt};
use crate::session::session_file::{persist_messages, readable_session_file};
use crate::systems::goose_hints::GooseHintsSystem;
use goose::agent::Agent;
use goose::developer::DeveloperSystem;
use goose::models::message::Message;
use goose::models::role::Role;

use super::message_serialize::deserialize_messages;

pub struct Session<'a> {
    agent: Box<Agent>,
    prompt: Box<dyn Prompt + 'a>,
    session_file: PathBuf,
    messages: Vec<Message>,
}

impl<'a> Session<'a> {
    pub fn new(agent: Box<Agent>, prompt: Box<dyn Prompt + 'a>, session_file: PathBuf) -> Self {
        let messages = match readable_session_file(&session_file) {
            Ok(file) => deserialize_messages(file).unwrap_or_else(|e| {
                eprintln!(
                    "Failed to read messages from session file. Starting fresh.\n{}",
                    e
                );
                Vec::<Message>::new()
            }),
            Err(e) => {
                eprintln!("Failed to load session file. Starting fresh.\n{}", e);
                Vec::<Message>::new()
            }
        };

        Session {
            agent,
            prompt,
            session_file,
            messages,
        }
    }

    pub async fn start(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.setup_session();

        loop {
            let input = self.prompt.get_input().unwrap();
            match input.input_type {
                InputType::Message => {
                    if let Some(content) = &input.content {
                        self.messages.push(Message::user().with_text(content));
                        persist_messages(&self.session_file, &self.messages)?;
                    }
                }
                InputType::Exit => break,
                InputType::AskAgain => continue,
            }

            self.prompt.show_busy();
            self.agent_process_messages().await;
            self.prompt.hide_busy();
        }
        self.close_session();
        Ok(())
    }

    pub async fn headless_start(
        &mut self,
        initial_message: Box<String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.setup_session();

        self.messages
            .push(Message::user().with_text(initial_message.as_str()));
        persist_messages(&self.session_file, &self.messages)?;

        self.agent_process_messages().await;

        self.close_session();
        Ok(())
    }

    async fn agent_process_messages(&mut self) {
        let mut stream = match self.agent.reply(&self.messages).await {
            Ok(stream) => stream,
            Err(e) => {
                eprintln!("Error starting reply stream: {}", e);
                return;
            }
        };
        loop {
            tokio::select! {
                response = stream.next() => {
                    match response {
                        Some(Ok(message)) => {
                            self.messages.push(message.clone());
                            persist_messages(&self.session_file, &self.messages).unwrap_or_else(|e| eprintln!("Failed to persist messages: {}", e));
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
                    while let Some(message) = self.messages.pop() {
                        if message.role == Role::User {
                            break;
                        }
                        // else drop any assistant messages.
                    }

                    self.prompt.render(raw_message(" Interrupt: Resetting conversation to before the last sent message...\n"));
                    break;
                }
            }
        }
    }

    fn setup_session(&mut self) {
        let system = Box::new(DeveloperSystem::new());
        self.agent.add_system(system);
        self.prompt
            .render(raw_message("Connected developer system."));

        let goosehints_system = Box::new(GooseHintsSystem::new());
        self.agent.add_system(goosehints_system);
        self.prompt
            .render(raw_message("Connected .goosehints system."));

        self.prompt.goose_ready();
    }

    fn close_session(&mut self) {
        self.prompt.render(raw_message(
            format!(
                "Closing session. Recorded to {}\n",
                self.session_file.display()
            )
            .as_str(),
        ));
        self.prompt.close();
    }
}

fn raw_message(content: &str) -> Box<Message> {
    Box::new(Message::assistant().with_text(content))
}
