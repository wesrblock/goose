use serde::{Deserialize, Serialize};
use serde_json::Value;

// Base trait for all content types
pub trait ContentType: Send + Sync {
    fn content_type(&self) -> &'static str;
    fn to_json(&self) -> Value;
    fn summary(&self) -> String;
}

// Text content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Text {
    pub text: String,
}

impl ContentType for Text {
    fn content_type(&self) -> &'static str {
        "Text"
    }

    fn to_json(&self) -> Value {
        serde_json::json!({
            "type": self.content_type(),
            "text": self.text,
        })
    }

    fn summary(&self) -> String {
        format!("content:text\n{}", self.text)
    }
}

// Tool use content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolUse {
    pub id: String,
    pub name: String,
    pub parameters: Value,
    #[serde(default)]
    pub is_error: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

impl ContentType for ToolUse {
    fn content_type(&self) -> &'static str {
        "ToolUse"
    }

    fn to_json(&self) -> Value {
        serde_json::json!({
            "type": self.content_type(),
            "id": self.id,
            "name": self.name,
            "parameters": self.parameters,
            "is_error": self.is_error,
            "error_message": self.error_message,
        })
    }

    fn summary(&self) -> String {
        format!(
            "content:tool_use:{}\nparameters:{}",
            self.name,
            serde_json::to_string(&self.parameters).unwrap_or_default()
        )
    }
}

// Tool result content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub tool_use_id: String,
    pub output: String,
    #[serde(default)]
    pub is_error: bool,
}

impl ContentType for ToolResult {
    fn content_type(&self) -> &'static str {
        "ToolResult"
    }

    fn to_json(&self) -> Value {
        serde_json::json!({
            "type": self.content_type(),
            "tool_use_id": self.tool_use_id,
            "output": self.output,
            "is_error": self.is_error,
        })
    }

    fn summary(&self) -> String {
        format!(
            "content:tool_result:error={}\noutput:{}",
            self.is_error,
            self.output
        )
    }
}

// Enum to handle all content types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Content {
    Text(Text),
    ToolUse(ToolUse),
    ToolResult(ToolResult),
}

impl Content {
    pub fn to_json(&self) -> Value {
        match self {
            Content::Text(t) => t.to_json(),
            Content::ToolUse(t) => t.to_json(),
            Content::ToolResult(t) => t.to_json(),
        }
    }

    pub fn summary(&self) -> String {
        match self {
            Content::Text(t) => t.summary(),
            Content::ToolUse(t) => t.summary(),
            Content::ToolResult(t) => t.summary(),
        }
    }
}
