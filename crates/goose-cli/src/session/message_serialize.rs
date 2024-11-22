use goose::models::tool::ToolCall;
use serde::{Serialize, Deserialize};
use std::fs::File;
use std::io::{self, BufRead};
use anyhow::Result;
use serde_json;

use goose::models::message::{Message, MessageContent};
use goose::models::role::Role;
use goose::models::content::{TextContent, ImageContent, Content};
use goose::models::message::{ToolRequest, ToolResponse};
use goose::errors::AgentError;


/// A wrapper struct for Message that implements Serialize
#[derive(Serialize, Deserialize)]
pub struct SerializableMessage<'a> {
    pub role: &'a str,
    pub created: i64,
    pub content: Vec<SerializableContent>,
}

#[derive(Serialize, Deserialize)]
#[serde(untagged)]
pub enum SerializableContent {
    Text {
        text: String,
    },
    ToolRequest {
        id: String,
        tool_name: String,
        arguments: serde_json::Value,
    },
    ToolResponse {
        id: String,
        tool_result: String,
    },
    Image {
        mime_type: String,
    },
}

impl<'a> From<&'a Message> for SerializableMessage<'a> {
    fn from(msg: &'a Message) -> Self {
        let role = match msg.role {
            Role::Assistant => "assistant",
            Role::User => "user",
        };

        let created = msg.created;

        // Process all content items
        let content: Vec<SerializableContent> = msg
            .content
            .iter()
            .map(|content| {
                match content {
                    MessageContent::Text(text) => SerializableContent::Text {
                        text: text.text.to_string(),
                    },
                    MessageContent::ToolRequest(req) => match &req.tool_call {
                        Ok(tool_call) => SerializableContent::ToolRequest {
                            id: req.id.clone(),
                            tool_name: tool_call.name.clone(),
                            arguments: tool_call.arguments.clone(),
                        },
                        Err(e) => SerializableContent::Text {
                            text: format!("Tool Request Error: {}", e),
                        },
                    },
                    MessageContent::ToolResponse(resp) => SerializableContent::ToolResponse {
                        id: resp.id.clone(),
                        tool_result: match &resp.tool_result {
                            Ok(content) => serde_json::to_string(content).unwrap_or_else(|e| {
                                format!("{{\"error\": \"Failed to serialize: {}\"}}", e)
                            }),
                            Err(e) => format!("{{\"error\": \"{}\"}}", e),
                        },
                    },
                    MessageContent::Image(img) => SerializableContent::Image {
                        mime_type: img.mime_type.clone(),
                    },
                }
            })
            .collect();

        SerializableMessage {
            role,
            created,
            content,
        }
    }
}

pub fn deserialize_messages(file: File) -> Result<Vec<Message>> {
    let reader = io::BufReader::new(file);
    let mut messages = Vec::new();

    for line in reader.lines() {
        let line = line?;
        let serialized: SerializableMessage = serde_json::from_str(&line)?;
        
        let role = match serialized.role {
            "assistant" => Role::Assistant,
            "user" => Role::User,
            _ => return Err(anyhow::anyhow!("Invalid role")),
        };

        let content = serialized.content.into_iter().map(|c| {
            match c {
                SerializableContent::Text { text } => {
                    MessageContent::Text(TextContent {
                        text,
                        audience: None,
                        priority: None,
                    })
                },
                SerializableContent::ToolRequest { id, tool_name, arguments } => {
                    MessageContent::ToolRequest(ToolRequest {
                        id,
                        tool_call: Ok(ToolCall {
                            name: tool_name,
                            arguments,
                        })
                    })
                },
                SerializableContent::ToolResponse { id, tool_result } => {
                    MessageContent::ToolResponse(ToolResponse {
                        id,
                        tool_result: serde_json::from_str(&tool_result)
                            .map(|v: serde_json::Value| {
                                vec![Content::Text(TextContent {
                                    text: v.to_string(),
                                    audience: None,
                                    priority: None,
                                })]
                            })
                            .map_err(|e| AgentError::Internal(e.to_string())),
                    })
                },
                SerializableContent::Image { mime_type } => {
                    MessageContent::Image(ImageContent {
                        mime_type,
                        data: String::new(),
                        audience: None,
                        priority: None,
                    })
                },
            }
        }).collect();

        messages.push(Message {
            role,
            created: serialized.created,
            content,
        });
    }

    Ok(messages)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::NamedTempFile;

    use crate::session::message_serialize::deserialize_messages;
    use crate::session::session_file::persist_messages_internal;
    use goose::models::role::Role;
    use goose::models::tool::ToolCall;
    use goose::models::message::{Message, MessageContent};
    use goose::models::content::{TextContent, ImageContent, Content};
    use goose::models::message::{ToolRequest, ToolResponse};


    #[test]
    fn test_persist_text_message() -> Result<()> {
        let temp_file = NamedTempFile::new()?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
            
        let messages = vec![Message {
            role: Role::User,
            created: now,
            content: vec![MessageContent::Text(TextContent {
                text: "Hello, world!".to_string(),
                audience: None,
                priority: None,
            })],
        }];

        persist_messages_internal(temp_file.reopen()?, &messages)?;
        let deserialized = deserialize_messages(temp_file.reopen()?)?;
        
        assert_eq!(messages.len(), deserialized.len());
        if let MessageContent::Text(text) = &messages[0].content[0] {
            if let MessageContent::Text(deserialized_text) = &deserialized[0].content[0] {
                assert_eq!(text.text, deserialized_text.text);
            } else {
                panic!("Deserialized content is not text");
            }
        }
        Ok(())
    }

    #[test]
    fn test_persist_tool_request() -> Result<()> {
        let temp_file = NamedTempFile::new()?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
            
        let messages = vec![Message {
            role: Role::Assistant,
            created: now,
            content: vec![MessageContent::ToolRequest(ToolRequest {
                id: "magic".to_string(),
                tool_call: Ok(ToolCall {
                    name: "test_tool".to_string(),
                    arguments: json!({"arg": "value"}),
                })
            })],
        }];

        persist_messages_internal(temp_file.reopen()?, &messages)?;
        let deserialized = deserialize_messages(temp_file.reopen()?)?;
        
        assert_eq!(messages.len(), deserialized.len());
        if let MessageContent::ToolRequest(req) = &messages[0].content[0] {
            if let MessageContent::ToolRequest(deserialized_req) = &deserialized[0].content[0] {
                if let (Ok(call), Ok(deserialized_call)) = (&req.tool_call, &deserialized_req.tool_call) {
                    assert_eq!(req.id, deserialized_req.id);
                    assert_eq!(call.name, deserialized_call.name);
                    assert_eq!(call.arguments, deserialized_call.arguments);
                } else {
                    panic!("Tool call results don't match");
                }
            } else {
                panic!("Deserialized content is not a tool request");
            }
        }
        Ok(())
    }

    #[test]
    fn test_persist_tool_response() -> Result<()> {
        let temp_file = NamedTempFile::new()?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
            
        let messages = vec![Message {
            role: Role::Assistant,
            created: now,
            content: vec![MessageContent::ToolResponse(ToolResponse {
                id: "test_id".to_string(),
                tool_result: Ok(vec![Content::Text(TextContent {
                    text: "success".to_string(),
                    audience: None,
                    priority: None,
                })]),
            })],
        }];

        persist_messages_internal(temp_file.reopen()?, &messages)?;
        let deserialized = deserialize_messages(temp_file.reopen()?)?;
        
        assert_eq!(messages.len(), deserialized.len());
        if let MessageContent::ToolResponse(resp) = &messages[0].content[0] {
            if let MessageContent::ToolResponse(deserialized_resp) = &deserialized[0].content[0] {
                assert_eq!(resp.id, deserialized_resp.id);
                assert!(resp.tool_result.is_ok());
                assert!(deserialized_resp.tool_result.is_ok());
            } else {
                panic!("Deserialized content is not a tool response");
            }
        }
        Ok(())
    }

    #[test]
    fn test_persist_image() -> Result<()> {
        let temp_file = NamedTempFile::new()?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
            
        let messages = vec![Message {
            role: Role::User,
            created: now,
            content: vec![MessageContent::Image(ImageContent {
                mime_type: "image/png".to_string(),
                data: "base64data".to_string(),
                audience: None,
                priority: None,
            })],
        }];

        persist_messages_internal(temp_file.reopen()?, &messages)?;
        let deserialized = deserialize_messages(temp_file.reopen()?)?;
        
        assert_eq!(messages.len(), deserialized.len());
        if let MessageContent::Image(img) = &messages[0].content[0] {
            if let MessageContent::Image(deserialized_img) = &deserialized[0].content[0] {
                assert_eq!(img.mime_type, deserialized_img.mime_type);
                // We don't check data since it's not serialized
            } else {
                panic!("Deserialized content is not an image");
            }
        }
        Ok(())
    }
}