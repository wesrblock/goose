use anyhow::Result as AnyhowResult;
use async_trait::async_trait;
use futures::future::BoxFuture;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

use crate::errors::AgentResult;
use crate::models::content::Content;
use crate::models::tool::{Tool, ToolCall};

/// Type alias for a cancellation function that can be called to terminate a running operation
pub type CancelFn = Arc<dyn Fn() + Send + Sync>;

/// Represents a cancellable future that will eventually produce an AgentResult<Vec<Content>>
pub struct CancellableOperation {
    /// Function to call to cancel the operation
    pub cancel: CancelFn,
    /// Future that will resolve to the operation result
    pub future: BoxFuture<'static, AgentResult<Vec<Content>>>,
}

impl CancellableOperation {
    /// Helper method for tests - executes the operation and unwraps the result
    #[cfg(test)]
    pub async fn unwrap(self) -> Vec<Content> {
        self.future.await.unwrap()
    }

    /// Helper method for tests - executes the operation and unwraps the error
    #[cfg(test)]
    pub async fn unwrap_err(self) -> crate::errors::AgentError {
        self.future.await.unwrap_err()
    }
}

/// Core trait that defines a system that can be operated by an AI agent
#[async_trait]
pub trait System: Send + Sync + ClonableSystem {
    /// Get the name of the system
    fn name(&self) -> &str;

    /// Get the system description
    fn description(&self) -> &str;

    /// Get system instructions
    fn instructions(&self) -> &str;

    /// Get available tools
    fn tools(&self) -> &[Tool];

    /// Get current system status
    async fn status(&self) -> AnyhowResult<HashMap<String, Value>>;

    /// Call a tool with the given parameters, returning a CancellableOperation that contains
    /// both a cancellation function and a future that will resolve to the operation result
    async fn call(&self, tool_call: ToolCall) -> CancellableOperation;
}

pub trait ClonableSystem {
    fn clone_box(&self) -> Box<dyn System>;
}

impl<T> ClonableSystem for T
where
    T: 'static + System + Clone,
{
    fn clone_box(&self) -> Box<dyn System> {
        Box::new(self.clone())
    }
}

impl Clone for Box<dyn System> {
    fn clone(&self) -> Box<dyn System> {
        self.clone_box()
    }
}