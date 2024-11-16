use axum::{
    extract::State,
    http::{self, HeaderMap, StatusCode},
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use bytes::Bytes;
use futures::{stream::StreamExt, Stream};
use goose::{
    agent::Agent,
    developer::DeveloperSystem,
    providers::{
        configs::ProviderConfig,
        factory::{self, ProviderType},
        types::{
            content::Content,
            message::{Message, Role},
        },
    },
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    convert::Infallible,
    pin::Pin,
    task::{Context, Poll},
};
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;

use crate::state::AppState;



// Request type matching the Python implementation
#[derive(Debug, Deserialize)]
struct ChatRequest {
    messages: Vec<Value>,
}

// Custom SSE response type that implements the Vercel AI SDK protocol
pub struct SseResponse {
    rx: ReceiverStream<String>,
}

impl SseResponse {
    fn new(rx: ReceiverStream<String>) -> Self {
        Self { rx }
    }
}

impl Stream for SseResponse {
    type Item = Result<Bytes, Infallible>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        Pin::new(&mut self.rx)
            .poll_next(cx)
            .map(|opt| opt.map(|s| Ok(Bytes::from(s))))
    }
}

impl IntoResponse for SseResponse {
    fn into_response(self) -> axum::response::Response {
        let stream = self;
        let body = axum::body::Body::from_stream(stream);

        http::Response::builder()
            .header("Content-Type", "text/event-stream")
            .header("Cache-Control", "no-cache")
            .header("Connection", "keep-alive")
            .header("x-vercel-ai-data-stream", "v1")
            .body(body)
            .unwrap()
    }
}

// Convert JSON message to our Message type
fn convert_message(value: &Value) -> Option<Message> {
    let role = value.get("role")?.as_str()?;
    let role = match role {
        "user" => Role::User,
        "assistant" => Role::Assistant,
        _ => return None,
    };

    let content = if let Some(content) = value.get("content") {
        if let Some(text) = content.as_str() {
            vec![Content::text(text)]
        } else if let Some(array) = content.as_array() {
            array
                .iter()
                .filter_map(|item| item.get("text").and_then(|t| t.as_str()).map(Content::text))
                .collect()
        } else {
            return None;
        }
    } else {
        Vec::new()
    };

    Message::new(role, content).ok()
}

async fn chat_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<ChatRequest>,
) -> Result<SseResponse, StatusCode> {
    // Check protocol header (optional in our case)
    if let Some(protocol) = headers.get("x-protocol") {
        if protocol.to_str().map(|p| p != "data").unwrap_or(true) {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    // Create channel for streaming
    let (tx, rx) = mpsc::channel(100);
    let stream = ReceiverStream::new(rx);

    // Setup agent with developer system
    let system = Box::new(DeveloperSystem::new());

    // Determine provider type based on config
    let provider_type = match &state.provider_config {
        ProviderConfig::OpenAi(_) => ProviderType::OpenAi,
        ProviderConfig::Databricks(_) => ProviderType::Databricks,
    };

    let provider = factory::get_provider(provider_type, state.provider_config)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut agent = Agent::new(provider);
    agent.add_system(system);

    // Convert incoming messages
    let messages: Vec<Message> = request
        .messages
        .iter()
        .filter_map(convert_message)
        .collect();

    // Spawn task to handle streaming
    tokio::spawn(async move {
        let mut stream = agent.reply(&messages);

        while let Some(response) = stream.next().await {
            match response {
                Ok(message) => {
                    match message.role {
                        Role::User => {
                            // Handle tool results if present
                            if let Some(Content::ToolResponse(tool_data)) = message.content.first() {
                                
                                let result = json!({
                                    "toolCallId": tool_data.request_id,
                                    "result": tool_data.output.as_ref().unwrap(),
                                });
                                let _ = tx.send(format!("a:{}\n", result)).await;
                            }
                        }
                        Role::Assistant => {
                            for content in message.content {
                                match content {
                                    Content::ToolRequest(request) => {
                                        if let Ok(call) = request.call {
                                            let tool_call = json!({
                                                "toolCallId": request.id,
                                                "toolName": call.name,
                                                "args": call.parameters
                                            });
                                            let _ = tx.send(format!("9:{}\n", tool_call)).await;
                                        }
                                    }
                                    _ => {
                                        let text = content.summary();
                                        if is_question_ask(&text) {
                                            print!("\n\n\n-------\n\n\n{}\n\n\n-------\n\n\n", &text);
                                            let task = format!("Following is some questions and information to present to the user. There may be lists of options of different kinds. 
                                            Present it in jsonld format strictly in the response: 
                                            ### Content: {}
                                            ### jsonld:\n", text);
                                            let jsonld = agent.complete_simple(&task).await;    
                                            match jsonld {
                                                Ok(message) => {
                                                    println!("Received message: {:?}", message.text());
                                                    let json_data = json!([{
                                                        "json-ld": message.text()
                                                    }]);
                                                    if let Err(e) = tx.send(format!("2:{}\n", json_data)).await {
                                                        tracing::error!("Error sending message through channel: {}", e);
                                                    }
                                                }, 
                                                Err(_e) => {
                                                    println!("Unable to talk to LLM")
                                                }
                                            }                                    
                                        }
                                        // Split text by newlines and send each line separately
                                        for line in text.lines() {
                                            let escaped_line = line.replace('\"', "\\\"");
                                            if let Err(e) = tx.send(format!("0:\"{}\"\n", escaped_line)).await {
                                                tracing::error!("Error sending line through channel: {}", e);
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Error processing message: {}", e);
                    break;
                }
            }
        }

        // Send finish message
        let finish = json!({
            "finishReason": "stop",
            "usage": {
                "promptTokens": 0,
                "completionTokens": 0
            }
        });
        let _ = tx.send(format!("d:{}\n", finish)).await;
    });

    Ok(SseResponse::new(stream))
}

// Configure routes for this module
pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/reply", post(chat_handler))
        .with_state(state)
}

/// Determines if a given text is likely to be a question or request for confirmation.
/// 
/// This function uses multiple heuristics to detect questions:
/// - Question marks at the end of sentences
/// - Question words (what, why, how, etc.)
/// - Modal verbs (can, could, would, etc.)
/// - Common question patterns
/// - Request phrases (please, could you, etc.)
/// 
/// # Arguments
/// 
/// * `text` - The text to analyze
/// 
/// # Returns
/// 
/// Returns true if the text appears to be a question or confirmation request
pub fn is_question_ask(text: &str) -> bool {
    let text = text.trim().to_lowercase();
    
    if text.is_empty() || text == "?" {
        return false;
    }

    // Quick check for question marks at the end (most common case for actual questions)
    if text.trim_end_matches(|c: char| !c.is_alphanumeric()).ends_with('?') {
        return true;
    }
    
    // Split text into words for analysis
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return false;
    }

    // Common question words at the start of a sentence
    const QUESTION_STARTERS: [&str; 9] = [
        "what", "why", "how", "when", "where", "who", "which", "whose", "are"
    ];
    
    // Modal verbs and auxiliary verbs that often indicate questions
    const QUESTION_VERBS: [&str; 9] = [
        "can", "could", "will", "would", "should", "may", "do", "does", "have"
    ];

    // Check if sentence starts with a question word or auxiliary verb
    if QUESTION_STARTERS.contains(&words[0]) {
        return true;
    }

    // Check for verb patterns
    if words.len() >= 2 {
        // Check for inverted sentence structure (verb + subject)
        if QUESTION_VERBS.contains(&words[0]) {
            if words[1] == "you" || words[1] == "i" || words[1] == "we" || words[1] == "this" {
                return true;
            }
        }
        
        // Check for "is/are there/this/that" patterns
        if (words[0] == "is" || words[0] == "are") && 
           words.len() > 2 && 
           (words[1] == "there" || words[1] == "this" || words[1] == "that" || words[1] == "we") {
            return true;
        }
    }

    // Check for request patterns
    let text_str = words.join(" ");
    let request_patterns = [
        "please", 
        "could you", 
        "would you",
        "can you",
        "i need to confirm",
        "confirm the plan",
        "what about",
        "tell me"
    ];

    if request_patterns.iter().any(|&pattern| text_str.contains(pattern)) {
        return true;
    }

    // Check for specific keyword combinations that indicate requests
    let has_plan = words.iter().any(|&w| w == "plan");
    let has_confirm = words.iter().any(|&w| w == "confirm");
    
    if has_plan && has_confirm {
        return true;
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_question_marks() {
        assert!(is_question_ask("Is this a question?"));
        assert!(is_question_ask("What about this one?"));
        assert!(is_question_ask("Why? Because I said so."));
        assert!(is_question_ask("This has a question mark in the middle? but continues."));
        assert!(is_question_ask("Multiple questions? In one text? Yes."));
    }

    #[test]
    fn test_question_words() {
        assert!(is_question_ask("What is the status"));
        assert!(is_question_ask("Why did this happen"));
        assert!(is_question_ask("How does this work"));
        assert!(is_question_ask("When will it be ready"));
        assert!(is_question_ask("Where should I look"));
        assert!(is_question_ask("Who is responsible"));
        assert!(is_question_ask("Which option is better"));
        assert!(is_question_ask("Whose code is this"));
    }

    #[test]
    fn test_modal_patterns() {
        assert!(is_question_ask("Can you help me"));
        assert!(is_question_ask("Could you explain"));
        assert!(is_question_ask("Will this work"));
        assert!(is_question_ask("Would you mind"));
        assert!(is_question_ask("Should I proceed"));
        assert!(is_question_ask("May I ask something"));
    }

    #[test]
    fn test_request_patterns() {
        assert!(is_question_ask("Please confirm the plan"));
        assert!(is_question_ask("Could you look at this"));
        assert!(is_question_ask("Would you review the code"));
        assert!(is_question_ask("Can you check this"));
        assert!(is_question_ask("I need to confirm the approach"));
        assert!(is_question_ask("Tell me what you think"));
    }

    #[test]
    fn test_complex_questions() {
        assert!(is_question_ask("Do you think this will work"));
        assert!(is_question_ask("Are we ready to proceed"));
        assert!(is_question_ask("Have you seen any errors"));
        assert!(is_question_ask("Is there a better way to do this"));
    }

    #[test]
    fn test_negative_cases() {
        assert!(!is_question_ask("This is a statement."));
        assert!(!is_question_ask("Just the word plan."));
        assert!(!is_question_ask("Only confirm."));
        assert!(!is_question_ask(""));
        assert!(!is_question_ask("   "));
        assert!(!is_question_ask("The code runs well."));
        assert!(!is_question_ask("Everything is working."));
        // New test case for embedded question marks
        assert!(!is_question_ask("this ?thing? will go ahead now"));
        assert!(!is_question_ask("The ?optional? parameter is required"));
        assert!(!is_question_ask("Using ?wildcards? in the search"));
        assert!(!is_question_ask("I'll help you implement this plan. Let's start by examining the relevant code and then make the necessary changes."));
    }

    #[test]
    fn test_case_insensitivity() {
        assert!(is_question_ask("WOULD YOU Confirm THE Plan"));
        assert!(is_question_ask("would YOU confirm the PLAN"));
        assert!(is_question_ask("What About This?"));
        assert!(is_question_ask("CAN You Help ME"));
    }

    #[test]
    fn test_edge_cases() {
        assert!(!is_question_ask("?"));  // Single question mark
        assert!(is_question_ask("????")); // Multiple question marks
        assert!(!is_question_ask("plan.confirm")); // Connected words
        assert!(is_question_ask("would you? plan")); // Mixed patterns
        assert!(!is_question_ask("question.mark.in.middle"));
    }
}
