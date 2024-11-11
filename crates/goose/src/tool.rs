use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt::Debug;

/// A tool that can be used by a model.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Tool {
    /// The name of the tool
    pub name: String,
    /// A description of what the tool does
    pub description: String,
    /// Parameters that the tool accepts
    pub parameters: Value,
}

impl Tool {
    /// Create a new tool with the given name and description
    pub fn new<N, D>(name: N, description: D, parameters: Value) -> Self
    where
        N: Into<String>,
        D: Into<String>,
    {
        Tool {
            name: name.into(),
            description: description.into(),
            parameters,
        }
    }
}

/// A tool call request that a system can execute
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolCall {
    /// The name of the tool to execute
    pub name: String,
    /// The parameters for the execution
    pub parameters: Value,
}

impl ToolCall {
    /// Create a new ToolUse with the given name and parameters
    pub fn new<S: Into<String>>(name: S, parameters: Value) -> Self {
        Self {
            name: name.into(),
            parameters,
        }
    }
}
