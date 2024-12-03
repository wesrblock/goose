use anyhow::Result as AnyhowResult;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::errors::AgentResult;
use crate::models::content::Content;
use crate::models::tool::{Tool, ToolCall};

/// Represents a resource output from a system's status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceOutput {
    /// The content of the resource
    pub content: String,
    /// Timestamp when the resource was created/updated
    pub timestamp: DateTime<Utc>,
    /// Priority of the resource (between 0.0 and 1.0)
    pub priority: f32,
}

impl ResourceOutput {
    /// Creates a new ResourceOutput with the given parameters
    ///
    /// # Arguments
    /// * `content` - The content of the resource
    /// * `priority` - Priority value between 0.0 and 1.0 (will be clamped to this range)
    /// * `timestamp` - The timestamp for this resource. Use `Utc::now()` for current time.
    ///
    /// # Returns
    /// A new ResourceOutput instance
    ///
    /// # Example
    /// ```rust
    /// use chrono::Utc;
    /// use goose::systems::system::ResourceOutput;
    /// let output = ResourceOutput::new("System status: OK", 0.8, Utc::now());
    /// ```
    pub fn new(content: impl Into<String>, priority: f32, timestamp: DateTime<Utc>) -> Self {
        Self {
            content: content.into(),
            timestamp,
            priority: priority.clamp(0.0, 1.0),
        }
    }
}

/// A resource that can be tracked by a system
#[derive(Debug, Clone)]
pub struct Resource {
    /// Path to the resource (if file-based)
    pub path: PathBuf,
    /// The content of the resource
    pub content: String,
    /// Timestamp when the resource was created/updated
    pub timestamp: DateTime<Utc>,
    /// Priority of the resource (between 0.0 and 1.0)
    pub priority: f32,
}

impl Resource {
    /// Creates a new Resource with the given parameters
    ///
    /// # Arguments
    /// * `path` - Path to the resource (if file-based)
    /// * `content` - The content of the resource
    /// * `priority` - Priority value between 0.0 and 1.0 (will be clamped to this range)
    /// * `timestamp` - The timestamp for this resource. Use `Utc::now()` for current time.
    ///
    /// # Returns
    /// A new Resource instance
    ///
    /// # Example
    /// ```rust
    /// use std::path::PathBuf;
    /// use chrono::Utc;
    /// use goose::systems::system::Resource;
    /// let resource = Resource::new(
    ///    PathBuf::from("example.txt"),
    ///    "Example content",
    ///    0.8,
    ///    Utc::now()
    /// );
    /// ```
    pub fn new(
        path: PathBuf,
        content: impl Into<String>,
        priority: f32,
        timestamp: DateTime<Utc>,
    ) -> Self {
        Self {
            path,
            content: content.into(),
            timestamp,
            priority: priority.clamp(0.0, 1.0),
        }
    }

    /// Convert this resource into a ResourceOutput
    pub fn into_output(&self) -> ResourceOutput {
        ResourceOutput {
            content: self.content.clone(),
            timestamp: self.timestamp,
            priority: self.priority,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resource_output() {
        // Test constructor with current time
        let content = "Test content";
        let priority = 0.5;
        let now = Utc::now();
        let output = ResourceOutput::new(content, priority, now);
        
        assert_eq!(output.content, content);
        assert_eq!(output.priority, priority);
        assert_eq!(output.timestamp, now);

        // Test with specific time
        let specific_time = Utc::now() - chrono::Duration::days(1);
        let output = ResourceOutput::new(content, priority, specific_time);
        
        assert_eq!(output.content, content);
        assert_eq!(output.priority, priority);
        assert_eq!(output.timestamp, specific_time);

        // Test priority clamping
        let output = ResourceOutput::new(content, 1.5, now);
        assert_eq!(output.priority, 1.0);
        
        let output = ResourceOutput::new(content, -0.5, now);
        assert_eq!(output.priority, 0.0);
    }
}

/// Core trait that defines a system that can be operated by an AI agent
#[async_trait]
pub trait System: Send + Sync {
    /// Get the name of the system
    fn name(&self) -> &str;

    /// Get the system description
    fn description(&self) -> &str;

    /// Get system instructions
    fn instructions(&self) -> &str;

    /// Get available tools
    fn tools(&self) -> &[Tool];

    /// Get current system status
    ///
    /// Returns a vector of ResourceOutput objects containing the system's current state
    /// Each ResourceOutput includes content, a timestamp, and a priority value
    async fn status(&self) -> AnyhowResult<Vec<ResourceOutput>>;

    /// Call a tool with the given parameters
    async fn call(&self, tool_call: ToolCall) -> AgentResult<Vec<Content>>;
}