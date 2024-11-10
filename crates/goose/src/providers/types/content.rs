use serde::{Deserialize, Serialize};
use serde_json::Value;

// Text content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Text {
    pub text: String,
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

// Tool result content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub tool_use_id: String,
    pub output: String,
    #[serde(default)]
    pub is_error: bool,
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
    pub fn summary(&self) -> String {
        match self {
            Content::Text(t) => format!("content:text\n{}", t.text),
            Content::ToolUse(t) => format!(
                "content:tool_use:{}\nparameters:{}",
                t.name,
                serde_json::to_string(&t.parameters).unwrap_or_default()
            ),
            Content::ToolResult(t) => format!(
                "content:tool_result:error={}\noutput:{}",
                t.is_error, t.output
            ),
        }
    }
}
