use std::time::Duration;
use anyhow::{Result, anyhow};
use reqwest::blocking::Client;  // we are using blocking API here to make sync calls
use reqwest::StatusCode;
use serde_json::{Value, json};

use super::{
    base::{Provider, Usage},
    configs::base::ProviderConfig,
    configs::openai::OpenAiProviderConfig,
    types::{message::Message, tool::Tool},
    utils::{messages_to_openai_spec, tools_to_openai_spec, openai_response_to_message, check_openai_context_length_error},
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
        let usage = data.get("usage")
            .ok_or_else(|| anyhow!("No usage data in response"))?;

        let input_tokens = usage.get("prompt_tokens")
            .and_then(|v| v.as_i64())
            .map(|v| v as i32);

        let output_tokens = usage.get("completion_tokens")
            .and_then(|v| v.as_i64())
            .map(|v| v as i32);

        let total_tokens = usage.get("total_tokens")
            .and_then(|v| v.as_i64())
            .map(|v| v as i32)
            .or_else(|| {
                match (input_tokens, output_tokens) {
                    (Some(input), Some(output)) => Some(input + output),
                    _ => None
                }
            });

        Ok(Usage::new(input_tokens, output_tokens, total_tokens))
    }

    fn post(&self, payload: Value) -> Result<Value> {
        let url = format!("{}v1/chat/completions", self.config.host);
        let response = self.client
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
            _ => Err(anyhow!("Request failed: {}", response.status()))
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
            payload.as_object_mut().unwrap().insert("tools".to_string(), json!(tools_spec));
        }
        if let Some(temp) = temperature {
            payload.as_object_mut().unwrap().insert("temperature".to_string(), json!(temp));
        }
        if let Some(tokens) = max_tokens {
            payload.as_object_mut().unwrap().insert("max_tokens".to_string(), json!(tokens));
        }
        if let Some(sequences) = stop_sequences {
            payload.as_object_mut().unwrap().insert("stop".to_string(), json!(sequences));
        }
        if let Some(p) = top_p {
            payload.as_object_mut().unwrap().insert("top_p".to_string(), json!(p));
        }

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

// #[cfg(test)]
// mod tests {
//     use super::*;
//     use crate::providers::types::message::Role;

//     #[test]
//     fn test_get_usage() {
//         let response = json!({
//             "usage": {
//                 "prompt_tokens": 10,
//                 "completion_tokens": 20,
//                 "total_tokens": 30
//             }
//         });

//         let usage = OpenAiProvider::get_usage(&response).unwrap();
//         assert_eq!(usage.input_tokens, Some(10));
//         assert_eq!(usage.output_tokens, Some(20));
//         assert_eq!(usage.total_tokens, Some(30));
//     }

//     #[test]
//     fn test_get_usage_calculated_total() {
//         let response = json!({
//             "usage": {
//                 "prompt_tokens": 10,
//                 "completion_tokens": 20
//             }
//         });

//         let usage = OpenAiProvider::get_usage(&response).unwrap();
//         assert_eq!(usage.input_tokens, Some(10));
//         assert_eq!(usage.output_tokens, Some(20));
//         assert_eq!(usage.total_tokens, Some(30));
//     }

//     #[test]
//     fn test_provider_creation() {
//         std::env::set_var("OPENAI_API_KEY", "test_key");

//         let provider = OpenAiProvider::from_env();
//         assert!(provider.is_ok());

//         std::env::remove_var("OPENAI_API_KEY");
//     }
// }
