use super::role::Role;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextContent {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audience: Option<Vec<Role>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<f32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageContent {
    pub data: String,
    pub mime_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audience: Option<Vec<Role>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<f32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
/// Content passed to or from an LLM
pub enum Content {
    Text(TextContent),
    Image(ImageContent),
}

impl Content {
    pub fn text<S: Into<String>>(text: S) -> Self {
        Content::Text(TextContent {
            text: text.into(),
            audience: None,
            priority: None,
        })
    }

    pub fn image<S: Into<String>, T: Into<String>>(data: S, mime_type: T) -> Self {
        Content::Image(ImageContent {
            data: data.into(),
            mime_type: mime_type.into(),
            audience: None,
            priority: None,
        })
    }

    /// Get the text content if this is a TextContent variant
    pub fn as_text(&self) -> Option<&str> {
        match self {
            Content::Text(text) => Some(&text.text),
            _ => None,
        }
    }

    /// Get the image content if this is an ImageContent variant
    pub fn as_image(&self) -> Option<(&str, &str)> {
        match self {
            Content::Image(image) => Some((&image.data, &image.mime_type)),
            _ => None,
        }
    }

    /// Set the audience for the content
    pub fn with_audience(mut self, audience: Vec<Role>) -> Self {
        match &mut self {
            Content::Text(text) => text.audience = Some(audience),
            Content::Image(image) => image.audience = Some(audience),
        }
        self
    }

    /// Set the priority for the content
    pub fn with_priority(mut self, priority: f32) -> Self {
        if !(0.0..=1.0).contains(&priority) {
            panic!("Priority must be between 0.0 and 1.0");
        }
        match &mut self {
            Content::Text(text) => text.priority = Some(priority),
            Content::Image(image) => image.priority = Some(priority),
        }
        self
    }

    /// Get the audience if set
    pub fn audience(&self) -> Option<&Vec<Role>> {
        match self {
            Content::Text(text) => text.audience.as_ref(),
            Content::Image(image) => image.audience.as_ref(),
        }
    }

    /// Get the priority if set
    pub fn priority(&self) -> Option<f32> {
        match self {
            Content::Text(text) => text.priority,
            Content::Image(image) => image.priority,
        }
    }

    pub fn unannotated(&self) -> Self {
        match self {
            Content::Text(text) => Content::text(text.text.clone()),
            Content::Image(image) => Content::image(image.data.clone(), image.mime_type.clone()),
        }
    }
}
