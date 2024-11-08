use anyhow::{anyhow, Result};
use reqwest::blocking::Client; // we are using blocking API here to make sync calls
use reqwest::StatusCode;
use serde_json::{json, Value};
use std::time::Duration;

use super::{
    base::{Provider, Usage},
    configs::base::ProviderConfig,
    configs::openai::OpenAiProviderConfig,
    types::{message::Message, tool::Tool},
    utils::{
        check_openai_context_length_error, messages_to_openai_spec, openai_response_to_message,
        tools_to_openai_spec,
    },
};

pub struct OpenAiProvider {
    client: Client,
    config: OpenAiProviderConfig,
}

impl OpenAiProvider {
    pub fn new(config: OpenAiProviderConfig) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(600)) // 10 minutes timeout
            .build()?;

        Ok(Self { client, config })
    }

    fn get_usage(data: &Value) -> Result<Usage> {
        let usage = data
            .get("usage")
            .ok_or_else(|| anyhow!("No usage data in response"))?;

        let input_tokens = usage
            .get("prompt_tokens")
            .and_then(|v| v.as_i64())
            .map(|v| v as i32);

        let output_tokens = usage
            .get("completion_tokens")
            .and_then(|v| v.as_i64())
            .map(|v| v as i32);

        let total_tokens = usage
            .get("total_tokens")
            .and_then(|v| v.as_i64())
            .map(|v| v as i32)
            .or_else(|| match (input_tokens, output_tokens) {
                (Some(input), Some(output)) => Some(input + output),
                _ => None,
            });

        Ok(Usage::new(input_tokens, output_tokens, total_tokens))
    }

    fn post(&self, payload: Value) -> Result<Value> {
        let url = format!(
            "{}/v1/chat/completions",
            self.config.host.trim_end_matches('/')
        );

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .json(&payload)
            .send()?;

        match response.status() {
            StatusCode::OK => Ok(response.json()?),
            status if status == StatusCode::TOO_MANY_REQUESTS || status.as_u16() >= 500 => {
                // Implement retry logic here if needed
                Err(anyhow!("Server error: {}", status))
            }
            _ => Err(anyhow!("Request failed: {}", response.status())),
        }
    }
}

impl Provider for OpenAiProvider {
    fn from_env() -> Result<Self> {
        let config = OpenAiProviderConfig::from_env()?;
        Self::new(config)
    }

    fn complete(
        &self,
        model: &str,
        system: &str,
        messages: &[Message],
        tools: &[Tool],
        temperature: Option<f32>,
        max_tokens: Option<i32>,
        stop_sequences: Option<&[String]>,
        top_p: Option<f32>,
    ) -> Result<(Message, Usage)> {
        // Not checking for o1 model here since system message is not supported by o1
        let system_message = json!({
            "role": "system",
            "content": system
        });

        // Convert messages and tools to OpenAI format
        let messages_spec = messages_to_openai_spec(messages);
        let tools_spec = if !tools.is_empty() {
            tools_to_openai_spec(tools)?
        } else {
            vec![]
        };

        // Build payload
        // create messages array with system message first
        let mut messages_array = vec![system_message];
        messages_array.extend(messages_spec);

        let mut payload = json!({
            "model": model,
            "messages": messages_array
        });

        // Add optional parameters
        if !tools_spec.is_empty() {
            payload
                .as_object_mut()
                .unwrap()
                .insert("tools".to_string(), json!(tools_spec));
        }
        if let Some(temp) = temperature {
            payload
                .as_object_mut()
                .unwrap()
                .insert("temperature".to_string(), json!(temp));
        }
        if let Some(tokens) = max_tokens {
            payload
                .as_object_mut()
                .unwrap()
                .insert("max_tokens".to_string(), json!(tokens));
        }
        if let Some(sequences) = stop_sequences {
            payload
                .as_object_mut()
                .unwrap()
                .insert("stop".to_string(), json!(sequences));
        }
        if let Some(p) = top_p {
            payload
                .as_object_mut()
                .unwrap()
                .insert("top_p".to_string(), json!(p));
        }

        // dbg!(&payload);

        // Make request
        let response = self.post(payload)?;

        // Check for context length error if single message
        if let Some(error) = response.get("error") {
            if messages.len() == 1 {
                if let Some(err) = check_openai_context_length_error(error) {
                    return Err(err.into());
                }
            }
            return Err(anyhow!("OpenAI API error: {}", error));
        }

        // Parse response
        let message = openai_response_to_message(response.clone())?;
        let usage = Self::get_usage(&response)?;

        Ok((message, usage))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_usage() {
        let response = json!({
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 20,
                "total_tokens": 30
            }
        });

        let usage = OpenAiProvider::get_usage(&response).unwrap();
        assert_eq!(usage.input_tokens, Some(10));
        assert_eq!(usage.output_tokens, Some(20));
        assert_eq!(usage.total_tokens, Some(30));
    }

    #[test]
    fn test_get_usage_calculated_total() {
        let response = json!({
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 20
            }
        });

        let usage = OpenAiProvider::get_usage(&response).unwrap();
        assert_eq!(usage.input_tokens, Some(10));
        assert_eq!(usage.output_tokens, Some(20));
        assert_eq!(usage.total_tokens, Some(30));
    }

    #[test]
    fn test_provider_creation() {
        std::env::set_var("OPENAI_API_KEY", "test_key");

        let provider = OpenAiProvider::from_env();
        assert!(provider.is_ok());

        std::env::remove_var("OPENAI_API_KEY");
    }
}
//     fn setup_mock_server(response_body: &str) -> (Mock, OpenAiProvider) {
//         let mut server = mockito::Server::new();
//         let mock = server.mock("POST", "/v1/chat/completions")
//             .match_header("authorization", "Bearer test_key")
//             .with_status(200)
//             .with_header("content-type", "application/json")
//             .with_body(response_body)
//             .create();

//         let config = OpenAiProviderConfig {
//             api_key: "test_key".to_string(),
//             host: server.url()
//         };
//         let provider = OpenAiProvider::new(config).unwrap();

//         (mock, provider)
//     }

//     fn setup_mock_server_for_complete() -> (Mock, OpenAiProvider) {
//         setup_mock_server(r#"{
//             "id": "chatcmpl-123",
//             "object": "chat.completion",
//             "choices": [{
//                 "index": 0,
//                 "message": {
//                     "role": "assistant",
//                     "content": "Hello! How can I assist you today?",
//                     "tool_calls": null
//                 },
//                 "finish_reason": "stop"
//             }],
//             "usage": {
//                 "prompt_tokens": 12,
//                 "completion_tokens": 15,
//                 "total_tokens": 27
//             }
//         }"#)
//     }

//     fn setup_mock_server_for_tools() -> (Mock, OpenAiProvider) {
//         setup_mock_server(r#"{
//             "id": "chatcmpl-tool",
//             "object": "chat.completion",
//             "choices": [{
//                 "index": 0,
//                 "message": {
//                     "role": "assistant",
//                     "content": null,
//                     "tool_calls": [{
//                         "id": "call_123",
//                         "type": "function",
//                         "function": {
//                             "name": "get_weather",
//                             "arguments": "{\"location\":\"San Francisco, CA\"}"
//                         }
//                     }]
//                 },
//                 "finish_reason": "tool_calls"
//             }],
//             "usage": {
//                 "prompt_tokens": 20,
//                 "completion_tokens": 15,
//                 "total_tokens": 35
//             }
//         }"#)
//     }

//     #[test]
//     fn test_basic_completion() -> Result<()> {
//         let (_mock, provider) = setup_mock_server_for_complete();

//         let result = provider.complete(
//             "gpt-4",
//             "You are a helpful assistant.",
//             &[Message::user("Hi")?],
//             &[],  // no tools
//             None,
//             None,
//             None,
//             None,
//         )?;

//         let (message, usage) = result;

//         // Verify response content
//         assert_eq!(message.text(), "Hello! How can I assist you today?");
//         assert!(message.tool_use().is_empty());

//         // Verify usage statistics
//         assert_eq!(usage.total_tokens, Some(27));
//         assert_eq!(usage.input_tokens, Some(12));
//         assert_eq!(usage.output_tokens, Some(15));

//         Ok(())
//     }

//     #[test]
//     fn test_completion_with_tool_call() -> Result<()> {
//         let (_mock, provider) = setup_mock_server_for_tools();

//         // Create a weather tool
//         let mut parameters = HashMap::new();
//         parameters.insert(
//             "location".to_string(),
//             json!({
//                 "type": "string",
//                 "description": "The city and state"
//             })
//         );

//         let weather_tool = Tool::new(
//             "get_weather".to_string(),
//             "Get the current weather".to_string(),
//             parameters,
//             |_| Ok(json!({"temperature": 72}))
//         );

//         let result = provider.complete(
//             "gpt-4",
//             "You are a helpful assistant.",
//             &[Message::user("What's the weather in San Francisco?")?],
//             &[weather_tool],
//             None,
//             None,
//             None,
//             None,
//         )?;

//         let (message, usage) = result;

//         // Verify tool calls
//         let tool_uses = message.tool_use();
//         assert_eq!(tool_uses.len(), 1);
//         assert_eq!(tool_uses[0].name, "get_weather");

//         // Verify tool parameters
//         let expected_params: Value = serde_json::from_str(
//             r#"{"location":"San Francisco, CA"}"#
//         )?;
//         assert_eq!(tool_uses[0].parameters, expected_params);

//         // Verify usage statistics
//         assert_eq!(usage.total_tokens, Some(35));
//         assert_eq!(usage.input_tokens, Some(20));
//         assert_eq!(usage.output_tokens, Some(15));

//         Ok(())
//     }

//     #[test]
//     fn test_completion_with_tool_result() -> Result<()> {
//         let (_mock, provider) = setup_mock_server_for_complete();

//         // Create messages including a tool result
//         let messages = vec![
//             Message::user("What's the weather?")?,
//             Message::new(
//                 Role::Assistant,
//                 vec![Content::ToolResult(ToolResult {
//                     tool_use_id: "call_123".to_string(),
//                     output: "The temperature is 72°F".to_string(),
//                     is_error: false,
//                 })]
//             )?
//         ];

//         let result = provider.complete(
//             "gpt-4",
//             "You are a helpful assistant.",
//             &messages,
//             &[],  // no tools needed for this response
//             None,
//             None,
//             None,
//             None,
//         )?;

//         let (message, usage) = result;

//         // Verify response
//         assert_eq!(message.text(), "Hello! How can I assist you today?");
//         assert!(message.tool_use().is_empty());

//         // Verify usage
//         assert_eq!(usage.total_tokens, Some(27));

//         Ok(())
//     }
// }
