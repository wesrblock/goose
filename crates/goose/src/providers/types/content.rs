use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

// Text content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Text {
    pub text: String,
}

impl Text {
    /// Create a new Text content with the given text
    pub fn new<S: Into<String>>(text: S) -> Self {
        Self { text: text.into() }
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

impl ToolUse {
    /// Create a new ToolUse with the given name and parameters
    pub fn new<S: Into<String>>(name: S, parameters: Value) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            parameters,
            is_error: false,
            error_message: None,
        }
    }

    /// Create a new error ToolUse with the given name and error message
    pub fn error<S1: Into<String>, S2: Into<String>>(name: S1, error_message: S2) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            parameters: Value::Null,
            is_error: true,
            error_message: Some(error_message.into()),
        }
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

impl ToolResult {
    /// Create a new successful ToolResult
    pub fn success<S1: Into<String>, S2: Into<String>>(tool_use_id: S1, output: S2) -> Self {
        Self {
            tool_use_id: tool_use_id.into(),
            output: output.into(),
            is_error: false,
        }
    }

    /// Create a new error ToolResult
    pub fn error<S1: Into<String>, S2: Into<String>>(tool_use_id: S1, error: S2) -> Self {
        Self {
            tool_use_id: tool_use_id.into(),
            output: error.into(),
            is_error: true,
        }
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
    /// Create a new Text content
    pub fn text<S: Into<String>>(text: S) -> Self {
        Content::Text(Text::new(text))
    }

    /// Create a new ToolUse content
    pub fn tool_use<S: Into<String>>(name: S, parameters: Value) -> Self {
        Content::ToolUse(ToolUse::new(name, parameters))
    }

    /// Create a new error ToolUse content
    pub fn tool_use_error<S1: Into<String>, S2: Into<String>>(name: S1, error: S2) -> Self {
        Content::ToolUse(ToolUse::error(name, error))
    }

    /// Create a new successful ToolResult content
    pub fn tool_result<S1: Into<String>, S2: Into<String>>(tool_use_id: S1, output: S2) -> Self {
        Content::ToolResult(ToolResult::success(tool_use_id, output))
    }

    /// Create a new error ToolResult content
    pub fn tool_result_error<S1: Into<String>, S2: Into<String>>(
        tool_use_id: S1,
        error: S2,
    ) -> Self {
        Content::ToolResult(ToolResult::error(tool_use_id, error))
    }

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
