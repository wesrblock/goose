use anyhow::Result as AnyhowResult;
use async_trait::async_trait;
use serde_json::{json, Value};
use std::collections::HashMap;

use goose::providers::types::content::ToolUse;
use goose::providers::types::tool::Tool;
use goose::systems::{System, ToolError, ToolResult};

/// A simple system that echoes input back to the caller
pub struct EchoSystem {
    tools: Vec<Tool>,
}

impl EchoSystem {
    pub fn new() -> Self {
        Self {
            tools: vec![Tool::new(
                "echo",
                "reply with the input",
                json!({
                    "type": "object",
                    "properties": {
                        "message": {
                            "type": "string",
                            "description": "The message to echo"
                        }
                    },
                    "required": ["message"]
                }),
            )],
        }
    }

    async fn echo(&self, params: Value) -> ToolResult<Value> {
        let message = params
            .get("message")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::InvalidParameters("message parameter required".into()))?;

        Ok(json!({ "response": message }))
    }
}

#[async_trait]
impl System for EchoSystem {
    fn name(&self) -> &str {
        "echo"
    }

    fn description(&self) -> &str {
        "A simple system that echoes input back to the caller"
    }

    fn instructions(&self) -> &str {
        "Use the echo tool to get a response back with your input message"
    }

    fn tools(&self) -> &[Tool] {
        &self.tools
    }

    async fn status(&self) -> AnyhowResult<HashMap<String, Value>> {
        Ok(HashMap::new()) // Echo system has no state to report
    }

    async fn call_tool(&self, tool_use: ToolUse) -> ToolResult<Value> {
        match tool_use.name.as_str() {
            "echo" => self.echo(tool_use.parameters).await,
            _ => ToolResult::Err(ToolError::ToolNotFound(tool_use.name)),
        }
    }
}

mod tests {
    use super::*;

    #[tokio::test]
    async fn test_echo_success() {
        let system = EchoSystem::new();

        let tool_use = ToolUse::new("echo", json!({"message": "hello world"}));
        let result = system.call_tool(tool_use).await.unwrap();
        assert_eq!(result, json!({ "response": "hello world" }));
    }

    #[tokio::test]
    async fn test_echo_missing_message() {
        let system = EchoSystem::new();

        let tool_use = ToolUse::new("echo", json!({}));
        let error = system.call_tool(tool_use).await.unwrap_err();

        assert!(matches!(error, ToolError::InvalidParameters(_)));
    }

    #[tokio::test]
    async fn test_unknown_tool() {
        let system = EchoSystem::new();

        let tool_use = ToolUse::new("unknown", json!({}));
        let error = system.call_tool(tool_use).await.unwrap_err();

        assert!(matches!(error, ToolError::ToolNotFound(_)));
    }
}
