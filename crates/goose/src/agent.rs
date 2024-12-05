use anyhow::Result;
use async_stream;
use futures::stream::BoxStream;
use serde_json::json;
use std::collections::HashMap;

use crate::errors::{AgentError, AgentResult};
use crate::models::content::Content;
use crate::models::message::{Message, ToolRequest};
use crate::models::tool::{Tool, ToolCall};
use crate::prompt_template::load_prompt_file;
use crate::providers::base::Provider;
use crate::systems::{System, Resource};
use crate::token_counter::TokenCounter;
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
struct SystemInfo {
    name: String,
    description: String,
    instructions: String,
}

impl SystemInfo {
    fn new(name: &str, description: &str, instructions: &str) -> Self {
        Self {
            name: name.to_string(),
            description: description.to_string(),
            instructions: instructions.to_string(),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
struct SystemStatus {
    name: String,
    status: String,
}

impl SystemStatus {
    fn new(name: &str, status: String) -> Self {
        Self {
            name: name.to_string(),
            status,
        }
    }
}

/// Agent integrates a foundational LLM with the systems it needs to pilot
pub struct Agent {
    systems: Vec<Box<dyn System>>,
    provider: Box<dyn Provider>,
}

impl Agent {
    /// Create a new Agent with the specified provider
    pub fn new(provider: Box<dyn Provider>) -> Self {
        Self {
            systems: Vec::new(),
            provider,
        }
    }

    /// Add a system to the agent
    pub fn add_system(&mut self, system: Box<dyn System>) {
        self.systems.push(system);
    }

    /// Get all tools from all systems with proper system prefixing
    fn get_prefixed_tools(&self) -> Vec<Tool> {
        let mut tools = Vec::new();
        for system in &self.systems {
            for tool in system.tools() {
                tools.push(Tool::new(
                    format!("{}__{}", system.name(), tool.name),
                    &tool.description,
                    tool.input_schema.clone(),
                ));
            }
        }
        tools
    }

    /// Find the appropriate system for a tool call based on the prefixed name
    fn get_system_for_tool(&self, prefixed_name: &str) -> Option<&dyn System> {
        let parts: Vec<&str> = prefixed_name.split("__").collect();
        if parts.len() != 2 {
            return None;
        }
        let system_name = parts[0];
        self.systems
            .iter()
            .find(|sys| sys.name() == system_name)
            .map(|v| &**v)
    }

    /// Dispatch a single tool call to the appropriate system
    async fn dispatch_tool_call(
        &self,
        tool_call: AgentResult<ToolCall>,
    ) -> AgentResult<Vec<Content>> {
        let call = tool_call?;
        let system = self
            .get_system_for_tool(&call.name)
            .ok_or_else(|| AgentError::ToolNotFound(call.name.clone()))?;

        let tool_name = call
            .name
            .split("__")
            .nth(1)
            .ok_or_else(|| AgentError::InvalidToolName(call.name.clone()))?;
        let system_tool_call = ToolCall::new(tool_name, call.arguments);

        system.call(system_tool_call).await
    }

    fn get_system_prompt(&self) -> AgentResult<String> {
        let mut context = HashMap::new();
        let systems_info: Vec<SystemInfo> = self
            .systems
            .iter()
            .map(|system| {
                SystemInfo::new(system.name(), system.description(), system.instructions())
            })
            .collect();

        context.insert("systems", systems_info);
        load_prompt_file("system.md", &context).map_err(|e| AgentError::Internal(e.to_string()))
    }

    /// Fetches the current status of all systems and formats it as a status message
    async fn get_system_status(&self) -> AgentResult<String> {
        // Get status of all systems
        let status = if !self.systems.is_empty() {
            let mut context = HashMap::new();
            let mut systems_status: Vec<SystemStatus> = Vec::new();
            for system in &self.systems {
                let system_status = system
                    .status()
                    .await
                    .map_err(|e| AgentError::Internal(e.to_string()))?;

                // For each resource, fetch its content
                let mut status_content = Vec::new();
                for resource in system_status {
                    if let Ok(content) = system.read_resource(&resource.uri).await {
                        status_content.push(format!("{}\n```\n{}\n```\n", resource.name, content));
                    }
                }

                // Join all resource content with newlines
                let status_str = status_content.join("\n");
                systems_status.push(SystemStatus::new(system.name(), status_str));
            }
            context.insert("systems", systems_status);
            load_prompt_file("status.md", &context)
                .map_err(|e| AgentError::Internal(e.to_string()))?
        } else {
            "No systems loaded".to_string()
        };

        Ok(status)
    }

    /// Gets token counts, resource metadata and content for each resource URI across all systems
    async fn get_system_status_counts(&self) -> AgentResult<HashMap<String, HashMap<String, (Resource, u32, String)>>> {
        let mut system_token_counts = HashMap::new();
        let token_counter = TokenCounter::new();
    
        for system in &self.systems {
            let system_status = system
                .status()
                .await
                .map_err(|e| AgentError::Internal(e.to_string()))?;
    
            let mut resource_counts = HashMap::new();
            for resource in system_status {
                if let Ok(content) = system.read_resource(&resource.uri).await {
                    let token_count = token_counter.count_tokens(&content, None) as u32;
                    resource_counts.insert(resource.uri.clone(), (resource, token_count, content));
                }
            }
    
            system_token_counts.insert(system.name().to_string(), resource_counts);
        }
        
        Ok(system_token_counts)
    }


    /// Trims the system status to reduce size while preserving critical information by sorting resources
    /// by priority and timestamp, removing older and lower priority resources to meet token limits
    fn trim_system_status(&self, status_counts: HashMap<String, HashMap<String, (Resource, u32, String)>>, approx_count: usize, context_limit: usize) -> AgentResult<String> {
        // Flatten all resources into a single vector for sorting
        let mut all_resources: Vec<(String, String, Resource, u32, String)> = Vec::new();
        for (system_name, resources) in status_counts.iter() {
            for (uri, (resource, token_count, content)) in resources {
                all_resources.push((
                    system_name.clone(),
                    uri.clone(),
                    resource.clone(),
                    *token_count,
                    content.clone(),
                ));
            }
        }

        // Sort by priority (high to low) and timestamp (newest to oldest)
        all_resources.sort_by(|a, b| {
            let priority_cmp = b.2.priority.cmp(&a.2.priority);
            if priority_cmp == std::cmp::Ordering::Equal {
                b.2.timestamp.cmp(&a.2.timestamp)
            } else {
                priority_cmp
            }
        });

        // Keep resources until we hit the context limit
        let mut current_tokens = approx_count as u32;
        let mut kept_resources = Vec::new();
        let target_limit = (context_limit as f32 * 0.9) as u32;
        
        // Start with all resources and remove until we're under target
        let mut remaining_resources: Vec<_> = all_resources.into_iter().collect();
        while current_tokens > target_limit {
            if let Some((_, _, _, token_count, _)) = remaining_resources.pop() {
                current_tokens -= token_count;
            } else {
                break;
            }
        }

        // Keep the remaining resources that fit under limit
        for (system_name, _, resource, _, content) in remaining_resources {
            kept_resources.push((system_name, resource, content));
        }

        // Group resources by system
        let mut systems_by_name: HashMap<String, Vec<(Resource, String)>> = HashMap::new();
        for (system_name, resource, content) in kept_resources {
            systems_by_name
                .entry(system_name)
                .or_default()
                .push((resource, content));
        }

        // Create the systems status for template
        let mut context = HashMap::new();
        let systems_status: Vec<SystemStatus> = systems_by_name
            .into_iter()
            .map(|(system_name, resources)| {
                let mut status_content = Vec::new();
                for (resource, content) in resources {
                    status_content.push(format!("{}\n```\n{}\n```\n", resource.name, content));
                }
                let status_str = status_content.join("\n");
                SystemStatus::new(&system_name, status_str)
            })
            .collect();

        context.insert("systems", systems_status);
        load_prompt_file("status.md", &context)
            .map_err(|e| AgentError::Internal(e.to_string()))
    }

    // Initialize a new reply round, which may call multiple tools
    async fn rewrite_messages_on_reply(
        &self,
        messages: &mut Vec<Message>,
        status: String,
    ) -> AgentResult<()> {
        // Create tool use message for status check
        let message_use =
            Message::assistant().with_tool_request("000", Ok(ToolCall::new("status", json!({}))));

        // Create tool result message with status
        let message_result =
            Message::user().with_tool_response("000", Ok(vec![Content::text(status)]));

        messages.push(message_use);
        messages.push(message_result);
        Ok(())
    }

    // Rewrite the exchange as needed after each tool call
    async fn rewrite_messages_on_tool_response(
        &self,
        messages: &mut Vec<Message>,
        pending: Vec<Message>,
        status: String,
    ) -> AgentResult<()> {
        // Remove the last two messages (status and tool response)
        messages.pop();
        messages.pop();

        // Append the pending messages
        messages.extend(pending);

        // Add back a fresh status and tool response
        let message_use =
            Message::assistant().with_tool_request("000", Ok(ToolCall::new("status", json!({}))));

        let message_result =
            Message::user().with_tool_response("000", Ok(vec![Content::text(status)]));

        messages.push(message_use);
        messages.push(message_result);

        Ok(())
    }

    /// Create a stream that yields each message as it's generated by the agent.
    /// This includes both the assistant's responses and any tool responses.
    pub async fn reply(&self, messages: &[Message]) -> Result<BoxStream<'_, Result<Message>>> {
        const CONTEXT_LIMIT: usize = 3000;
        let mut messages = messages.to_vec();
        let tools = self.get_prefixed_tools();
        let system_prompt = self.get_system_prompt()?;
        let token_counter = TokenCounter::new();
        let mut status;


        let approx_count = token_counter.count_chat_tokens(
            &system_prompt,
            &messages,
            &tools,
            Some("gpt-4"),
        );

        // Update conversation history for the start of the reply
        if approx_count > CONTEXT_LIMIT {
            let status_counts = self.get_system_status_counts().await?;
            status = self.trim_system_status(status_counts, approx_count, CONTEXT_LIMIT)?;
        } else {
            status = self.get_system_status().await?;
        }
        self.rewrite_messages_on_reply(&mut messages, status.clone())
            .await?;

        Ok(Box::pin(async_stream::try_stream! {
            loop {

                // Get completion from provider
                let (response, _) = self.provider.complete(
                    &system_prompt,
                    &messages,
                    &tools,
                ).await?;

                // The assistant's response is added in rewrite_messages_on_tool_response
                // Yield the assistant's response
                yield response.clone();

                // Not sure why this is needed, but this ensures that the above message is yielded
                // before the following potentially long-running commands start processing
                tokio::task::yield_now().await;

                // First collect any tool requests
                let tool_requests: Vec<&ToolRequest> = response.content
                    .iter()
                    .filter_map(|content| content.as_tool_request())
                    .collect();

                if tool_requests.is_empty() {
                    // No more tool calls, end the reply loop
                    break;
                }

                // Then dispatch each in parallel
                let futures: Vec<_> = tool_requests
                    .iter()
                    .map(|request| self.dispatch_tool_call(request.tool_call.clone()))
                    .collect();

                // Process all the futures in parallel but wait until all are finished
                let outputs = futures::future::join_all(futures).await;

                // Create a message with the responses
                let mut message_tool_response = Message::user();
                // Now combine these into MessageContent::ToolResponse using the original ID
                for (request, output) in tool_requests.iter().zip(outputs.into_iter()) {
                    message_tool_response = message_tool_response.with_tool_response(
                        request.id.clone(),
                        output,
                    );
                }

                yield message_tool_response.clone();

                // Update conversation history after the tool call round
                let token_counter = TokenCounter::new();
                let approx_count = token_counter.count_chat_tokens(
                    &system_prompt,
                    &messages,
                    &tools,
                    Some("gpt-4"),
                );

                let new_status;
                if approx_count > CONTEXT_LIMIT {
                    let status_counts = self.get_system_status_counts().await?;
                    new_status = self.trim_system_status(status_counts, approx_count, CONTEXT_LIMIT)?;
                } else {
                    new_status = self.get_system_status().await?;
                }

                self.rewrite_messages_on_tool_response(
                    &mut messages,
                    vec![response.clone(), message_tool_response],
                    new_status.clone(),
                ).await?;
            }
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::message::MessageContent;
    use crate::providers::mock::MockProvider;
    use crate::systems::Resource;
    use async_trait::async_trait;
    use futures::TryStreamExt;
    use serde_json::json;
    use chrono::{Utc, Duration};

    // Mock system for testing
    struct MockSystem {
        name: String,
        tools: Vec<Tool>,
    }

    impl MockSystem {
        fn new(name: &str) -> Self {
            Self {
                name: name.to_string(),
                tools: vec![Tool::new(
                    "echo",
                    "Echoes back the input",
                    json!({"type": "object", "properties": {"message": {"type": "string"}}, "required": ["message"]}),
                )],
            }
        }
    }

    #[async_trait]
    impl System for MockSystem {
        fn name(&self) -> &str {
            &self.name
        }

        fn description(&self) -> &str {
            "A mock system for testing"
        }

        fn instructions(&self) -> &str {
            "Mock system instructions"
        }

        fn tools(&self) -> &[Tool] {
            &self.tools
        }

        async fn status(&self) -> anyhow::Result<Vec<Resource>> {
            Ok(Vec::new())
        }

        async fn call(&self, tool_call: ToolCall) -> AgentResult<Vec<Content>> {
            match tool_call.name.as_str() {
                "echo" => Ok(vec![Content::text(
                    tool_call.arguments["message"].as_str().unwrap_or(""),
                )]),
                _ => Err(AgentError::ToolNotFound(tool_call.name)),
            }
        }

        async fn read_resource(&self, _uri: &str) -> AgentResult<String> {
            Ok("".to_string())
        }
    }

    #[tokio::test]
    async fn test_simple_response() -> Result<()> {
        let response = Message::assistant().with_text("Hello!");
        let provider = MockProvider::new(vec![response.clone()]);
        let agent = Agent::new(Box::new(provider));

        let initial_message = Message::user().with_text("Hi");
        let initial_messages = vec![initial_message];

        let mut stream = agent.reply(&initial_messages).await?;
        let mut messages = Vec::new();
        while let Some(msg) = stream.try_next().await? {
            messages.push(msg);
        }

        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0], response);
        Ok(())
    }

    #[tokio::test]
    async fn test_tool_call() -> Result<()> {
        let mut agent = Agent::new(Box::new(MockProvider::new(vec![
            Message::assistant().with_tool_request(
                "1",
                Ok(ToolCall::new("test_echo", json!({"message": "test"}))),
            ),
            Message::assistant().with_text("Done!"),
        ])));

        agent.add_system(Box::new(MockSystem::new("test")));

        let initial_message = Message::user().with_text("Echo test");
        let initial_messages = vec![initial_message];

        let mut stream = agent.reply(&initial_messages).await?;
        let mut messages = Vec::new();
        while let Some(msg) = stream.try_next().await? {
            messages.push(msg);
        }

        // Should have three messages: tool request, response, and model text
        assert_eq!(messages.len(), 3);
        assert!(messages[0]
            .content
            .iter()
            .any(|c| matches!(c, MessageContent::ToolRequest(_))));
        assert_eq!(messages[2].content[0], MessageContent::text("Done!"));
        Ok(())
    }

    #[tokio::test]
    async fn test_invalid_tool() -> Result<()> {
        let mut agent = Agent::new(Box::new(MockProvider::new(vec![
            Message::assistant()
                .with_tool_request("1", Ok(ToolCall::new("invalid_tool", json!({})))),
            Message::assistant().with_text("Error occurred"),
        ])));

        agent.add_system(Box::new(MockSystem::new("test")));

        let initial_message = Message::user().with_text("Invalid tool");
        let initial_messages = vec![initial_message];

        let mut stream = agent.reply(&initial_messages).await?;
        let mut messages = Vec::new();
        while let Some(msg) = stream.try_next().await? {
            messages.push(msg);
        }

        // Should have three messages: failed tool request, fail response, and model text
        assert_eq!(messages.len(), 3);
        assert!(messages[0]
            .content
            .iter()
            .any(|c| matches!(c, MessageContent::ToolRequest(_))));
        assert_eq!(
            messages[2].content[0],
            MessageContent::text("Error occurred")
        );
        Ok(())
    }

    #[tokio::test]
    async fn test_multiple_tool_calls() -> Result<()> {
        let mut agent = Agent::new(Box::new(MockProvider::new(vec![
            Message::assistant()
                .with_tool_request(
                    "1",
                    Ok(ToolCall::new("test_echo", json!({"message": "first"}))),
                )
                .with_tool_request(
                    "2",
                    Ok(ToolCall::new("test_echo", json!({"message": "second"}))),
                ),
            Message::assistant().with_text("All done!"),
        ])));

        agent.add_system(Box::new(MockSystem::new("test")));

        let initial_message = Message::user().with_text("Multiple calls");
        let initial_messages = vec![initial_message];

        let mut stream = agent.reply(&initial_messages).await?;
        let mut messages = Vec::new();
        while let Some(msg) = stream.try_next().await? {
            messages.push(msg);
        }

        // Should have three messages: tool requests, responses, and model text
        assert_eq!(messages.len(), 3);
        assert!(messages[0]
            .content
            .iter()
            .any(|c| matches!(c, MessageContent::ToolRequest(_))));
        assert_eq!(messages[2].content[0], MessageContent::text("All done!"));
        Ok(())
    }

    // Helper function to create test resources with different priorities and timestamps
    fn create_test_resource(name: &str, priority: i32, seconds_ago: i64) -> Resource {
        use chrono::{Utc, Duration};
        let now = Utc::now();
        let timestamp = now - Duration::seconds(seconds_ago);
        Resource {
            name: name.to_string(),
            uri: format!("test://{}", name),
            priority,
            timestamp,
            description: None,
            mime_type: "text".to_string(),
        }
    }

    #[test]
    fn test_trim_system_status_empty() -> Result<()> {
        let agent = Agent::new(Box::new(MockProvider::new(vec![])));
        let status_counts = HashMap::new();
        let result = agent.trim_system_status(status_counts, 1000, 2000)?;
        assert!(!result.is_empty()); // Should return template with no systems
        Ok(())
    }

    #[test]
    fn test_trim_system_status_single_system() -> Result<()> {
        let agent = Agent::new(Box::new(MockProvider::new(vec![])));
        
        let mut system_counts = HashMap::new();
        let mut resource_counts = HashMap::new();
        
        let resource = create_test_resource("test1", 1, 0);
        resource_counts.insert(
            "test://test1".to_string(), 
            (resource, 100, "test content".to_string())
        );
        
        system_counts.insert("system1".to_string(), resource_counts);
        
        let result = agent.trim_system_status(system_counts, 1000, 2000)?;
        assert!(result.contains("system1"));
        assert!(result.contains("test1"));
        Ok(())
    }

    #[test]
    fn test_trim_system_status_prioritization() -> Result<()> {
        let agent = Agent::new(Box::new(MockProvider::new(vec![])));
        
        let mut system_counts = HashMap::new();
        let mut resource_counts = HashMap::new();
        
        // Add resources with different priorities
        let high_priority = create_test_resource("high", 2, 10);
        let low_priority = create_test_resource("low", 1, 10);
        
        resource_counts.insert(
            "test://high".to_string(), 
            (high_priority, 500, "high priority content".to_string())
        );
        resource_counts.insert(
            "test://low".to_string(), 
            (low_priority, 500, "low priority content".to_string())
        );
        
        system_counts.insert("system1".to_string(), resource_counts);
        
        // Set a tight token limit that should only allow one resource
        let result = agent.trim_system_status(system_counts, 1100, 1000)?;
        
        // Should contain high priority but not low priority
        assert!(result.contains("high priority content"));
        assert!(!result.contains("low priority content"));
        Ok(())
    }

    #[test]
    fn test_get_system_status_counts_empty() -> Result<()> {
        let agent = Agent::new(Box::new(MockProvider::new(vec![])));
        let counts = tokio_test::block_on(agent.get_system_status_counts())?;
        assert!(counts.is_empty());
        Ok(())
    }

    #[test]
    fn test_get_system_status_counts_with_system() -> Result<()> {
        let mut agent = Agent::new(Box::new(MockProvider::new(vec![])));
        
        // Add a mock system that returns some resources
        struct TestSystem {
            resources: Vec<Resource>,
        }
        
        #[async_trait]
        impl System for TestSystem {
            fn name(&self) -> &str { "test_system" }
            fn description(&self) -> &str { "Test system" }
            fn instructions(&self) -> &str { "Test instructions" }
            fn tools(&self) -> &[Tool] { &[] }
            
            async fn status(&self) -> anyhow::Result<Vec<Resource>> {
                Ok(self.resources.clone())
            }
            
            async fn call(&self, _: ToolCall) -> AgentResult<Vec<Content>> {
                Ok(vec![])
            }
            
            async fn read_resource(&self, _: &str) -> AgentResult<String> {
                Ok("test content".to_string())
            }
        }
        
        let test_resource = create_test_resource("test1", 1, 0);
        let test_system = TestSystem {
            resources: vec![test_resource.clone()],
        };
        
        agent.add_system(Box::new(test_system));
        
        let counts = tokio_test::block_on(agent.get_system_status_counts())?;
        
        assert_eq!(counts.len(), 1);
        assert!(counts.contains_key("test_system"));
        
        let system_counts = counts.get("test_system").unwrap();
        assert_eq!(system_counts.len(), 1);
        assert!(system_counts.contains_key(&test_resource.uri));
        
        let (resource, count, content) = &system_counts[&test_resource.uri];
        assert_eq!(resource.name, "test1");
        assert!(*count > 0);
        assert_eq!(content, "test content");
        
        Ok(())
    }
}
