use anyhow::Result;
use futures::StreamExt;
use std::path::PathBuf;

use crate::prompt::prompt::{InputType, Prompt};
use crate::session::session_file::{persist_messages, readable_session_file};
use crate::systems::goose_hints::GooseHintsSystem;
use goose::agent::Agent;
use goose::developer::DeveloperSystem;
use goose::models::message::{Message, MessageContent};
use goose::models::role::Role;

use super::session_file::deserialize_messages;

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
        initial_message: String,
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
                    self.rewind_messages();
                    self.prompt.render(raw_message(" Interrupt: Resetting conversation to before the last sent message...\n"));
                    break;
                }
            }
        }
    }

    /// Rewind the messages to before the last user message (they have cancelled it).
    pub fn rewind_messages(&mut self) {
        if self.messages.is_empty() {
            return;
        }

        // Remove messages until we find the last user 'Text' message (not a tool response).
        while let Some(message) = self.messages.last() {
            if message.role == Role::User
                && message
                    .content
                    .iter()
                    .any(|c| matches!(c, MessageContent::Text(_)))
            {
                break;
            }
            self.messages.pop();
        }

        // Remove the last user text message we found.
        if !self.messages.is_empty() {
            self.messages.pop();
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

#[cfg(test)]
mod tests {
    use crate::prompt::prompt::{self, Input};
    use crate::session::mock_provider::MockProvider;

    use super::*;
    use goose::{errors::AgentResult, models::tool::ToolCall, providers::base::Provider};
    use tempfile::NamedTempFile;

    // Helper function to create a test session
    fn create_test_session() -> Session<'static> {
        let temp_file = NamedTempFile::new().unwrap();
        let provider: Box<dyn Provider> = Box::new(MockProvider::new(Vec::new()));
        let agent = Box::new(Agent::new(provider));
        let prompt = Box::new(MockPrompt {});
        Session::new(agent, prompt, temp_file.path().to_path_buf())
    }

    // Mock prompt implementation for testing
    struct MockPrompt {}
    impl Prompt for MockPrompt {
        fn get_input(&mut self) -> std::result::Result<prompt::Input, anyhow::Error> {
            Ok(Input {
                input_type: InputType::Message,
                content: Some("Msg:".to_string()),
            })
        }
        fn render(&mut self, _: Box<Message>) {}
        fn show_busy(&mut self) {}
        fn hide_busy(&self) {}
        fn goose_ready(&self) {}
        fn close(&self) {}
    }

    #[test]
    fn test_rewind_messages_only_user() {
        let mut session = create_test_session();
        session.messages.push(Message::user().with_text("Hello"));

        session.rewind_messages();
        assert!(session.messages.is_empty());
    }

    #[test]
    fn test_rewind_messages_user_then_assistant() {
        let mut session = create_test_session();
        session.messages.push(Message::user().with_text("Hello"));
        session
            .messages
            .push(Message::assistant().with_text("World"));

        session.rewind_messages();
        assert!(session.messages.is_empty());
    }

    #[test]
    fn test_rewind_messages_multiple_user_messages() {
        let mut session = create_test_session();
        session.messages.push(Message::user().with_text("First"));
        session
            .messages
            .push(Message::assistant().with_text("Response 1"));
        session.messages.push(Message::user().with_text("Second"));
        session.rewind_messages();
        assert_eq!(session.messages.len(), 2);
        assert_eq!(session.messages[0].role, Role::User);
        assert_eq!(session.messages[1].role, Role::Assistant);
        assert_eq!(
            session.messages[0].content[0],
            MessageContent::text("First")
        );
        assert_eq!(
            session.messages[1].content[0],
            MessageContent::text("Response 1")
        );
    }

    #[test]
    fn test_rewind_messages_after_interrupted_tool_request() {
        let mut session = create_test_session();
        session.messages.push(Message::user().with_text("First"));
        session
            .messages
            .push(Message::assistant().with_text("Response 1"));
        session.messages.push(Message::user().with_text("Use tool"));

        let mut mixed_msg = Message::assistant();
        mixed_msg.content.push(MessageContent::text("Using tool"));
        mixed_msg.content.push(MessageContent::tool_request(
            "test",
            AgentResult::Ok(ToolCall::new("test", "test".into())),
        ));
        session.messages.push(mixed_msg);

        session.messages.push(Message::user().with_tool_response(
            "test",
            Err(goose::errors::AgentError::ExecutionError(
                "Test".to_string(),
            )),
        ));

        session.rewind_messages();
        assert_eq!(session.messages.len(), 2);
        assert_eq!(session.messages[0].role, Role::User);
        assert_eq!(session.messages[1].role, Role::Assistant);
        assert_eq!(
            session.messages[0].content[0],
            MessageContent::text("First")
        );
        assert_eq!(
            session.messages[1].content[0],
            MessageContent::text("Response 1")
        );
    }
}
