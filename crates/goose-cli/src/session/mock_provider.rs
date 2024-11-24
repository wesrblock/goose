use anyhow::Result;
use async_trait::async_trait;
use std::sync::Arc;
use std::sync::Mutex;

use goose::models::message::Message;
use goose::models::tool::Tool;
use goose::providers::base::{Provider, Usage};

///
/// This is a copy of crates/goose/src/providers/mock.rs that I can't use as its configured out in that crate.
/// I need to use this in the test module of crates/goose-cli/src/session/session.rs but really what I need is to
/// mock the agent. But that requires a bit of refactor to use an agent trait which I don't want to do in this PR.
/// Therefore its a TODO to create a mock agent and remove this mock provider.

/// A mock provider that returns pre-configured responses for testing
pub struct MockProvider {
    responses: Arc<Mutex<Vec<Message>>>,
}

impl MockProvider {
    /// Create a new mock provider with a sequence of responses
    pub fn new(responses: Vec<Message>) -> Self {
        Self {
            responses: Arc::new(Mutex::new(responses)),
        }
    }
}

#[async_trait]
impl Provider for MockProvider {
    async fn complete(
        &self,
        _system_prompt: &str,
        _messages: &[Message],
        _tools: &[Tool],
    ) -> Result<(Message, Usage)> {
        let mut responses = self.responses.lock().unwrap();
        if responses.is_empty() {
            // Return empty response if no more pre-configured responses
            Ok((Message::assistant().with_text(""), Usage::default()))
        } else {
            Ok((responses.remove(0), Usage::default()))
        }
    }
}
