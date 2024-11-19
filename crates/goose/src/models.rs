//! These models represent the objects passed around by the agent
//!
//! There are several different related formats we need to interact with:
//! - vercel useChat messages/tools, sent from the interface to the agent
//! - vercel streaming protocol messages/tools, sent from the agent to the interface
//! - openai messages/tools, sent from the agent to the LLM
//! - anthropic messages/tools, sent from the agent to the LLM
//! - system requests, sent from the agent to the systems providing capabilities
//!
//! These all overlap to varying degrees. We always immediately convert those data models
//! into the internal structs using to/from helpers. Because of the need for compatibility,
//! the internal models are not an exactly match to any of these formats.
pub mod content;
pub mod message;
pub mod tool;
