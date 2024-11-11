use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
use crate::tool::ToolCall;
use crate::errors::AgentResult;

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


#[derive(Debug, Clone, Serialize, Deserialize)]
/// A request for a tool call from the agent
pub struct ToolRequest {
    /// A unique identifier for this tool request
    pub id: String,
    /// The requested tool call, which is a Result because it may be malformed
    pub call: AgentResult<ToolCall>,
}

impl ToolRequest {
    /// Create a new well-formed ToolRequest
    pub fn new<S: Into<String>>(name: S, parameters: Value) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            call: Ok(ToolCall::new(name, parameters)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResponse {
    /// The unique identifier for the original tool request
    pub request_id: String,
    /// The output of the tool call, which is a Result because the call may have errored
    pub output: AgentResult<Value>,
}

impl ToolResponse {
    /// Create a new well-formed ToolRequest
    pub fn new<S: Into<String>>(request_id: S, output: Value) -> Self {
        Self {
            request_id: request_id.into(),
            output: Ok(output.into()),
        }
    }
}


// Enum to handle all content types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Content {
    Text(Text),
    ToolRequest(ToolRequest),
    ToolResponse(ToolResponse),
}

impl Content {
    pub fn summary(&self) -> String {
        match self {
            Content::Text(t) => format!("content:text\n{}", t.text),
            Content::ToolRequest(t) => match &t.call {
                Ok(call) => format!(
                    "content:tool_use:{}\nparameters:{}",
                    call.name,
                    serde_json::to_string(&call.parameters).unwrap_or_default()
                ),
                Err(err) => format!(
                    "content:tool_use:error\nerror:{}",
                    err.to_string()
                )
            }
            Content::ToolResponse(t) => match &t.output {
                Ok(value) => format!(
                    "content:tool_result\noutput:{}",
                    serde_json::to_string(&value).unwrap_or("".to_string())
                ),
                Err(err) => format!(
                    "content:tool_result:error\nerror:{}",
                    err.to_string()
                )
            }
        }
    }
}
