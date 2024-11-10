use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

use super::content::{Content, ToolResult, ToolUse};
use super::objectid::create_object_id;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: Role,
    pub id: String,
    pub created: i64,
    pub content: Vec<Content>,
}

impl Message {
    pub fn new(role: Role, content: Vec<Content>) -> Result<Self> {
        let msg = Self {
            role,
            id: create_object_id("msg"),
            created: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64,
            content,
        };
        msg.validate()?;
        Ok(msg)
    }

    fn validate(&self) -> Result<()> {
        match self.role {
            Role::User => {
                if !self.has_text() && !self.has_tool_result() {
                    return Err(anyhow!("User message must include a Text or ToolResult"));
                }
                if self.has_tool_use() {
                    return Err(anyhow!("User message does not support ToolUse"));
                }
            }
            Role::Assistant => {
                if !self.has_text() && !self.has_tool_use() {
                    return Err(anyhow!("Assistant message must include a Text or ToolUse"));
                }
                if self.has_tool_result() {
                    return Err(anyhow!("Assistant message does not support ToolResult"));
                }
            }
        }
        Ok(())
    }

    pub fn text(&self) -> String {
        self.content
            .iter()
            .filter_map(|content| match content {
                Content::Text(text) => Some(text.text.clone()),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    pub fn tool_use(&self) -> Vec<ToolUse> {
        self.content
            .iter()
            .filter_map(|content| match content {
                Content::ToolUse(tool_use) => Some(tool_use.clone()),
                _ => None,
            })
            .collect()
    }

    pub fn tool_result(&self) -> Vec<ToolResult> {
        self.content
            .iter()
            .filter_map(|content| match content {
                Content::ToolResult(tool_result) => Some(tool_result.clone()),
                _ => None,
            })
            .collect()
    }

    pub fn has_text(&self) -> bool {
        self.content.iter().any(|c| matches!(c, Content::Text(_)))
    }

    pub fn has_tool_use(&self) -> bool {
        self.content
            .iter()
            .any(|c| matches!(c, Content::ToolUse(_)))
    }

    pub fn has_tool_result(&self) -> bool {
        self.content
            .iter()
            .any(|c| matches!(c, Content::ToolResult(_)))
    }

    pub fn user<S: Into<String>>(text: S) -> Result<Self> {
        Self::new(Role::User, vec![Content::text(text)])
    }

    pub fn assistant<S: Into<String>>(text: S) -> Result<Self> {
        Self::new(Role::Assistant, vec![Content::text(text)])
    }

    pub fn summary(&self) -> String {
        let content_summaries: Vec<String> = self.content.iter().map(|c| c.summary()).collect();
        format!("message:{:?}\n{}", self.role, content_summaries.join("\n"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    #[test]
    fn test_user_message() -> Result<()> {
        let user_message = Message::user("abcd")?;
        assert!(matches!(user_message.role, Role::User));
        assert_eq!(user_message.text(), "abcd");
        Ok(())
    }

    #[test]
    fn test_assistant_message() -> Result<()> {
        let assistant_message = Message::assistant("abcd")?;
        assert!(matches!(assistant_message.role, Role::Assistant));
        assert_eq!(assistant_message.text(), "abcd");
        Ok(())
    }

    #[test]
    fn test_message_tool_use() -> Result<()> {
        let message = Message::new(
            Role::Assistant,
            vec![
                Content::tool_use("tool", json!({})),
                Content::tool_use("tool", json!({})),
            ],
        )?;

        let tool_uses = message.tool_use();
        assert_eq!(tool_uses.len(), 2);
        assert_eq!(tool_uses[0].name, "tool");
        Ok(())
    }

    #[test]
    fn test_message_tool_result() -> Result<()> {
        let message = Message::new(
            Role::User,
            vec![
                Content::tool_result("1", "result"),
                Content::tool_result("2", "result"),
            ],
        )?;

        let tool_results = message.tool_result();
        assert_eq!(tool_results.len(), 2);
        assert_eq!(tool_results[0].output, "result");
        Ok(())
    }

    #[test]
    fn test_message_validation() -> Result<()> {
        // Valid user message
        let message = Message::user("Hello")?;
        assert_eq!(message.text(), "Hello");

        // Valid assistant message
        let message = Message::assistant("Hello")?;
        assert_eq!(message.text(), "Hello");

        // Invalid message: user with tool_use
        let result = Message::new(
            Role::User,
            vec![Content::text(""), Content::tool_use("tool", json!({}))],
        );
        assert!(result.is_err());

        // Invalid message: assistant with tool_result
        let result = Message::new(
            Role::Assistant,
            vec![Content::text(""), Content::tool_result("1", "result")],
        );
        assert!(result.is_err());
        Ok(())
    }

    #[test]
    fn test_serialization() -> Result<()> {
        // Test basic message serialization
        let message = Message::user("Hello, world!")?;
        let serialized = serde_json::to_string(&message)?;
        let deserialized: Message = serde_json::from_str(&serialized)?;
        assert_eq!(message.text(), deserialized.text());
        assert!(matches!(deserialized.role, Role::User));

        // Test complex message with tool use
        let message = Message::new(
            Role::Assistant,
            vec![
                Content::text("Using tool"),
                Content::tool_use("test_tool", json!({"key": "value"})),
            ],
        )?;

        let serialized = serde_json::to_string(&message)?;
        let deserialized: Message = serde_json::from_str(&serialized)?;

        assert_eq!(message.text(), deserialized.text());
        assert_eq!(message.tool_use().len(), deserialized.tool_use().len());
        assert_eq!(message.tool_use()[0].name, deserialized.tool_use()[0].name);

        // Verify JSON structure
        let json_value: Value = serde_json::from_str(&serialized)?;
        assert!(json_value.get("id").is_some());
        assert!(json_value.get("created").is_some());
        assert!(json_value.get("role").is_some());
        assert!(json_value.get("content").is_some());

        Ok(())
    }
}
