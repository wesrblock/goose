use serde::{Deserialize, Serialize};
use thiserror::Error;

#[non_exhaustive]
#[derive(Error, Debug, Clone, Deserialize, Serialize)]
pub enum AgentError {
    #[error("Tool not found: {0}")]
    ToolNotFound(String),

    #[error("Invalid parameters: {0}")]
    InvalidParameters(String),

    #[error("Tool execution failed: {0}")]
    ExecutionError(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

pub type AgentResult<T> = Result<T, AgentError>;
