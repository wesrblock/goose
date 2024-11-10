use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt::Debug;

/// A tool that can be used by a model.
#[derive(Clone, Serialize, Deserialize)]
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

impl Debug for Tool {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Tool")
            .field("name", &self.name)
            .field("description", &self.description)
            .field("parameters", &self.parameters)
            .finish()
    }
}
