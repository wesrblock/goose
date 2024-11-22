use anyhow::Result;
use serde_json;
use std::fs::File;
use std::io::{self, BufRead};

use goose::models::message::Message;

pub fn deserialize_messages(file: File) -> Result<Vec<Message>> {
    let reader = io::BufReader::new(file);
    let mut messages = Vec::new();

    for line in reader.lines() {
        messages.push(serde_json::from_str::<Message>(&line?)?);
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
    use goose::models::content::{Content, ImageContent, TextContent};
    use goose::models::message::{Message, MessageContent};
    use goose::models::message::{ToolRequest, ToolResponse};
    use goose::models::role::Role;
    use goose::models::tool::ToolCall;

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
                audience: Some(vec![Role::User]),
                priority: Some(1.0),
            })],
        }];

        persist_messages_internal(temp_file.reopen()?, &messages)?;
        let deserialized = deserialize_messages(temp_file.reopen()?)?;

        assert_eq!(messages.len(), deserialized.len());
        if let MessageContent::Text(text) = &messages[0].content[0] {
            if let MessageContent::Text(deserialized_text) = &deserialized[0].content[0] {
                assert_eq!(text.text, deserialized_text.text);
                assert_eq!(text.audience, deserialized_text.audience);
                assert_eq!(text.priority, deserialized_text.priority);
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
                }),
            })],
        }];

        persist_messages_internal(temp_file.reopen()?, &messages)?;
        let deserialized = deserialize_messages(temp_file.reopen()?)?;

        assert_eq!(messages.len(), deserialized.len());
        if let MessageContent::ToolRequest(req) = &messages[0].content[0] {
            if let MessageContent::ToolRequest(deserialized_req) = &deserialized[0].content[0] {
                if let (Ok(call), Ok(deserialized_call)) =
                    (&req.tool_call, &deserialized_req.tool_call)
                {
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
                assert_eq!(resp.tool_result, deserialized_resp.tool_result);
                assert!(deserialized_resp.tool_result.is_ok());
            } else {
                panic!("Deserialized content is not a tool response");
            }
        }
        Ok(())
    }

    #[test]
    fn test_persist_tool_response_multiple_content() -> Result<()> {
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
                tool_result: Ok(vec![
                    Content::Text(TextContent {
                        text: "first result".to_string(),
                        audience: Some(vec![Role::User]),
                        priority: Some(1.0),
                    }),
                    Content::Text(TextContent {
                        text: "second result".to_string(),
                        audience: None,
                        priority: None,
                    }),
                ]),
            })],
        }];

        persist_messages_internal(temp_file.reopen()?, &messages)?;
        let deserialized = deserialize_messages(temp_file.reopen()?)?;

        assert_eq!(messages.len(), deserialized.len());
        if let MessageContent::ToolResponse(resp) = &messages[0].content[0] {
            if let MessageContent::ToolResponse(deserialized_resp) = &deserialized[0].content[0] {
                assert_eq!(resp.id, deserialized_resp.id);
                if let (Ok(original_results), Ok(deserialized_results)) =
                    (&resp.tool_result, &deserialized_resp.tool_result)
                {
                    assert_eq!(original_results.len(), deserialized_results.len());

                    // Check first result with audience and priority
                    if let (Content::Text(original_text), Content::Text(deserialized_text)) =
                        (&original_results[0], &deserialized_results[0])
                    {
                        assert_eq!(original_text.text, deserialized_text.text);
                        assert_eq!(original_text.audience, deserialized_text.audience);
                        assert_eq!(original_text.priority, deserialized_text.priority);
                    }

                    // Check second result without audience and priority
                    if let (Content::Text(original_text), Content::Text(deserialized_text)) =
                        (&original_results[1], &deserialized_results[1])
                    {
                        assert_eq!(original_text.text, deserialized_text.text);
                        assert_eq!(original_text.audience, deserialized_text.audience);
                        assert_eq!(original_text.priority, deserialized_text.priority);
                    }
                } else {
                    panic!("Tool result is not Ok");
                }
            } else {
                panic!("Deserialized content is not a tool response");
            }
        }
        Ok(())
    }

    #[test]
    fn test_persist_tool_response_with_image() -> Result<()> {
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
                tool_result: Ok(vec![
                    Content::Text(TextContent {
                        text: "text result".to_string(),
                        audience: None,
                        priority: None,
                    }),
                    Content::Image(ImageContent {
                        mime_type: "image/png".to_string(),
                        data: "base64data".to_string(),
                        audience: Some(vec![Role::User]),
                        priority: Some(1.0),
                    }),
                ]),
            })],
        }];

        persist_messages_internal(temp_file.reopen()?, &messages)?;
        let deserialized = deserialize_messages(temp_file.reopen()?)?;

        assert_eq!(messages.len(), deserialized.len());
        if let MessageContent::ToolResponse(resp) = &messages[0].content[0] {
            if let MessageContent::ToolResponse(deserialized_resp) = &deserialized[0].content[0] {
                assert_eq!(resp.id, deserialized_resp.id);
                if let (Ok(original_results), Ok(deserialized_results)) =
                    (&resp.tool_result, &deserialized_resp.tool_result)
                {
                    assert_eq!(original_results.len(), deserialized_results.len());

                    // Check text content
                    if let (Content::Text(original_text), Content::Text(deserialized_text)) =
                        (&original_results[0], &deserialized_results[0])
                    {
                        assert_eq!(original_text.text, deserialized_text.text);
                    } else {
                        panic!("First result is not text content");
                    }

                    // Check image content
                    if let (Content::Image(original_img), Content::Image(deserialized_img)) =
                        (&original_results[1], &deserialized_results[1])
                    {
                        assert_eq!(original_img.mime_type, deserialized_img.mime_type);
                        assert_eq!(original_img.data, deserialized_img.data);
                        assert_eq!(original_img.audience, deserialized_img.audience);
                        assert_eq!(original_img.priority, deserialized_img.priority);
                    } else {
                        panic!("Second result is not image content");
                    }
                }
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
                assert_eq!(img.data, deserialized_img.data);
            } else {
                panic!("Deserialized content is not an image");
            }
        }
        Ok(())
    }
}
