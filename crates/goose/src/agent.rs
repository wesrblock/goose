use anyhow::Result;
use serde_json::{json, Value};
use std::collections::HashMap;
use tokio::sync::RwLock;

use crate::{
    providers::{
        base::Provider,
        configs::ProviderConfig,
        factory::{get_provider, ProviderType},
        types::{
            content::{Content, ToolResponse},
            message::{Message, Role},
        },
    },
    systems::System,
    tool::{Tool, ToolCall},
};

pub struct Agent {
    systems: Vec<Box<dyn System>>,
    provider: Box<dyn Provider>,
    processor_model: String,
    model_messages: RwLock<Vec<Message>>,
}

impl Agent {
    pub fn new(
        systems: Vec<Box<dyn System>>,
        provider_type: ProviderType,
        provider_config: ProviderConfig,
        processor_model: String,
    ) -> Self {
        Self {
            systems,
            provider: get_provider(provider_type, provider_config).unwrap(),
            processor_model,
            model_messages: RwLock::new(Vec::new()),
        }
    }

    pub async fn model_messages(&self) -> Vec<Message> {
        self.model_messages.read().await.clone()
    }

    fn get_tools(&self) -> Vec<Tool> {
        self.systems
            .iter()
            .flat_map(|system| system.tools().iter().cloned())
            .collect()
    }

    fn tool_to_system_map(&self) -> HashMap<String, &dyn System> {
        let mut map = HashMap::new();
        for system in &self.systems {
            for tool in system.tools() {
                map.insert(tool.name.clone(), system.as_ref());
            }
        }
        map
    }

    async fn call_system_tool(&self, tool_call: ToolCall) -> Result<Value> {
        let tool_map = self.tool_to_system_map();

        if let Some(system) = tool_map.get(&tool_call.name) {
            Ok(system.call(tool_call).await?)
        } else {
            let valid_tools = tool_map.keys().cloned().collect::<Vec<_>>().join(", ");
            Err(anyhow::anyhow!(
                "No tool exists with name '{}'. Valid tools are: {}",
                tool_call.name,
                valid_tools
            ))
        }
    }

    pub async fn reply(
        &self,
        interface_messages: Vec<HashMap<String, String>>,
        max_tool_calls: Option<i32>,
    ) -> Result<Vec<Message>> {
        let mut max_tool_calls = max_tool_calls.unwrap_or(10);
        let mut responses = Vec::new();

        // TODO: Load prompt from file
        // system_prompt = Message.load("prompt.md", systems=self.systems).text
        let system_prompt = "You are a helpful assistant.";

        // interface_messages = list[dict], model_messages = list[Message]
        // model_messages =  interface_messages.convert() + [status_use, status_result]
        let mut model_messages = Vec::new();
        model_messages.extend(interface_messages.iter().map(|msg| {
            Message::new(Role::User, vec![Content::text(msg["content"].clone())]).unwrap()
        }));

        // let (status_use, status_result) = self.get_status().await?;
        // model_messages.push(status_use);
        // model_messages.push(status_result);

        let (response, _) = self
            .provider
            .complete(
                &self.processor_model,
                system_prompt,
                &model_messages,
                &self.get_tools(),
                None,
                None,
            )
            .await?;

        // println!("Response: {:?}", response);

        responses.push(response.clone());

        // Handle tool calls
        while !response.tool_request().is_empty() && max_tool_calls > 0 {
            let mut tool_responses = Vec::new();

            for tool_request in response.tool_request() {
                let response_content = match &tool_request.call {
                    Ok(tool_call) => match self.call_system_tool(tool_call.clone()).await {
                        Ok(result) => result,
                        Err(e) => json!({
                            "error": format!("Tool execution failed: {}", e)
                        }),
                    },
                    Err(e) => json!({
                        "error": format!("Invalid tool request: {}", e)
                    }),
                };

                // println!("In tool calling loop -> response: {:?}", response_content);

                tool_responses.push(Content::ToolResponse(ToolResponse::new(
                    &tool_request.id,
                    response_content,
                )));
            }

            let result = Message::new(Role::User, tool_responses)?;
            responses.push(result.clone());

            // Update model messages for next iteration
            model_messages.push(response.clone());
            model_messages.push(result);

            let (new_response, _) = self
                .provider
                .complete(
                    &self.processor_model,
                    system_prompt,
                    &model_messages,
                    &self.get_tools(),
                    None,
                    None,
                )
                .await?;

            responses.push(new_response.clone());
            max_tool_calls -= 1;
        }

        Ok(responses)
    }
}
