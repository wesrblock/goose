use thiserror::Error;

#[derive(Error, Debug)]
pub enum ToolError {
    #[error("Tool not found: {0}")]
    ToolNotFound(String),

    #[error("Invalid parameters: {0}")]
    InvalidParameters(String),

    #[error("Tool execution failed: {0}")]
    ExecutionError(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

pub type ToolResult<T> = Result<T, ToolError>;
