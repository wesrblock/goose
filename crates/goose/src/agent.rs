// use anyhow::Result;
// use serde_json::{json, Value};
// use std::collections::HashMap;
// use tokio::sync::RwLock;

// use crate::{
//     providers::{factory::{ProviderType, get_provider}, types::{content::{Content, ToolRequest, ToolResponse}, message::{Message, Role}}},
//     systems::System,
//     tool::{Tool, ToolCall},
// };



// pub struct Agent {
//     systems: Vec<Box<dyn System>>,
//     interface_messages: RwLock<Vec<Message>>,
//     provider: ProviderType,
//     provider_config: ProviderConfig,
//     processor_model: String,
//     model_messages: RwLock<Vec<Message>>,
// }

// impl Agent {
//     pub fn new(
//         systems: Vec<Box<dyn System>>,
//         provider_type: ProviderType,
//         provider_config: ProviderConfig,
//         processor_model: String,
//     ) -> Self {
//         Self {
//             systems,
//             interface_messages: RwLock::new(Vec::new()),
//             provider_type,
//             provider_config,
//             processor_model,
//             model_messages: RwLock::new(Vec::new()),
//         }
//     }

//     fn get_tools(&self) -> Vec<Tool> {
//         self.systems.iter().flat_map(|system| system.tools().iter().cloned()).collect()
//     }

//     async fn logged(&self, message: Message) -> Result<Message> {
//         let mut messages = self.interface_messages.write().await;
//         messages.push(message.clone());
//         Ok(message)
//     }

//     async fn get_status(&self) -> Result<(Message, Message)> {
//         // TODO: Implement proper status prompt
//         let status = "TODO: implement status prompt".to_string();

//         let message_use = Message::new(
//             Role::Assistant,
//             vec![Content::ToolRequest(ToolRequest::new("status", json!({})))],
//         )?;

//         let message_result = Message::new(
//             Role::User,
//             vec![Content::ToolResponse(ToolResponse::new("000", json!(status)))],
//         )?;

//         Ok((message_use, message_result))
//     }

//     fn _complete(&self, messages: &[Message], tools: &[Tool], temperature: Option<f32>, max_tokens: Option<i32>) -> Result<(Message, Usage)> {
//         let temperature = temperature.unwrap_or(0.0);
//         let max_tokens = max_tokens.unwrap_or(4096);

//         self.provider.complete(self.processor_model, system, messages, tools, temperature, max_tokens)
//     }

//     async fn get_summary(&self) -> Result<String> {
//         let interface_messages = self.interface_messages.read().await;
//         let summary = interface_messages
//             .iter()
//             .map(|m| m.summary())
//             .collect::<Vec<_>>()
//             .join("\n\n");

//         let message = Message::user(summary)?;
//         let (response_msg, _) = self
//             .provider
//             .complete(
//                 &self.processor_model,
//                 "TODO: implement summary prompt",
//                 &[message],
//                 &[],
//                 None,
//                 None,
//             )
//             .await?;

//         Ok(response_msg.text())
//     }

//     async fn initialize(&self, messages: &[Message]) -> Result<Vec<Message>> {
//         let (status_use, status_result) = self.get_status().await?;

//         let mut result = Vec::new();
//         result.extend(self.interface_messages.read().await.clone());
//         result.push(status_use);
//         result.push(status_result);

//         Ok(result)
//     }

//     fn tool_to_system_map(&self) -> HashMap<String, &dyn System> {
//         let mut map = HashMap::new();
//         for system in &self.systems {
//             for tool in system.tools() {
//                 map.insert(tool.name.clone(), system.as_ref());
//             }
//         }
//         map
//     }

//     async fn call_system_tool(&self, tool_call: ToolCall) -> Result<Value> {
//         let tool_map = self.tool_to_system_map();

//         if let Some(system) = tool_map.get(&tool_call.name) {
//             system.call(tool_call).await?.map_err(|e| anyhow!(e))
//         } else {
//             let valid_tools = tool_map.keys().cloned().collect::<Vec<_>>().join(", ");
//             Err(anyhow!(
//                 "No tool exists with name '{}'. Valid tools are: {}",
//                 tool_call.name,
//                 valid_tools
//             ))
//         }
//     }

//     pub async fn reply(&self, messages: Vec<Value>) -> Result<Vec<Message>> {
//         let mut responses = Vec::new();

//         for msg in messages {
//             let content = msg["content"]
//                 .as_str()
//                 .ok_or_else(|| anyhow!("Message content must be a string"))?;
//             let message = Message::user(content)?;
//             responses.push(self.logged(message).await?);
//         }

//         // TODO: Load prompt from file
//         let prompt = "TODO: implement prompt loading";

//         let mut model_messages = self.initialize(&responses).await?;

//         let (response, _) = self
//             .provider
//             .complete(
//                 &self.processor_model,
//                 prompt,
//                 &model_messages,
//                 &self.get_tools(),
//                 None,
//                 None,
//             )
//             .await?;

//         responses.push(self.logged(response.clone()).await?);

//         // Handle tool calls
//         while !response.tool_request().is_empty() {
//             let mut tool_responses = Vec::new();

//             for tool_request in response.tool_request() {
//                 if let Some(call) = tool_request.call {
//                     match self.call_system_tool(call).await {
//                         Ok(result) => {
//                             tool_responses.push(Content::ToolResponse(
//                                 ToolResponse::new(&tool_request.id, result)
//                             ));
//                         }
//                         Err(e) => {
//                             tool_responses.push(Content::ToolResponse(
//                                 ToolResponse::new(&tool_request.id, json!({
//                                     "error": e.to_string()
//                                 }))
//                             ));
//                         }
//                     }
//                 }
//             }

//             let result = Message::new(Role::User, tool_responses)?;
//             responses.push(self.logged(result.clone()).await?);

//             // Update model messages for next iteration
//             model_messages.push(response.clone());
//             model_messages.push(result);

//             let (new_response, _) = self
//                 .provider
//                 .complete(
//                     &self.processor_model,
//                     prompt,
//                     &model_messages,
//                     &self.get_tools(),
//                     None,
//                     None,
//                 )
//                 .await?;

//             responses.push(self.logged(new_response.clone()).await?);
//         }

//         Ok(responses)
//     }
// }
