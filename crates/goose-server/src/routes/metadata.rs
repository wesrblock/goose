use axum::{
    extract::Query,
    response::Json,
    routing::get,
    Router,
};
use reqwest::header::USER_AGENT;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use url::Url;
use tracing::{info, error, warn};

#[derive(Debug, Serialize)]
pub struct Metadata {
    title: Option<String>,
    description: Option<String>,
    favicon: Option<String>,
    image: Option<String>,
    url: String,
}

#[derive(Debug, Deserialize)]
pub struct MetadataQuery {
    url: String,
}

pub async fn get_metadata(
    Query(params): Query<HashMap<String, String>>,
) -> Json<Metadata> {
    let url = params.get("url").expect("URL is required");
    info!("📨 Received metadata request for URL: {}", url);

    let metadata = fetch_metadata(url).await.unwrap_or_else(|e| {
        error!("❌ Error fetching metadata: {:?}", e);
        Metadata {
            title: None,
            description: None,
            favicon: None,
            image: None,
            url: url.to_string(),
        }
    });

    info!("✅ Returning metadata: {:?}", metadata);
    Json(metadata)
}

async fn fetch_metadata(url: &str) -> Result<Metadata, Box<dyn std::error::Error>> {
    info!("🌐 Making request to: {}", url);
    
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .header(USER_AGENT, "Mozilla/5.0 (compatible; Goose/1.0)")
        .send()
        .await?;

    info!("📥 Response status: {}", response.status());
    info!("📤 Response headers: {:?}", response.headers());

    let html = response.text().await?;
    let document = Html::parse_document(&html);
    let base_url = Url::parse(url)?;

    info!("📄 Successfully parsed HTML document");

    // Title selector with detailed logging
    let title = document
        .select(&Selector::parse("title").unwrap())
        .next()
        .map(|el| el.text().collect::<String>())
        .or_else(|| {
            info!("⚠️ No <title> tag found, trying OpenGraph title");
            document
                .select(&Selector::parse("meta[property='og:title']").unwrap())
                .next()
                .and_then(|el| el.value().attr("content"))
                .map(String::from)
        });

    info!("📝 Found title: {:?}", title);

    // Description selector with fallbacks
    let description = document
        .select(&Selector::parse("meta[name='description']").unwrap())
        .next()
        .or_else(|| {
            info!("⚠️ No meta description found, trying OpenGraph description");
            document
                .select(&Selector::parse("meta[property='og:description']").unwrap())
                .next()
        })
        .and_then(|el| el.value().attr("content"))
        .map(String::from);

    info!("📝 Found description: {:?}", description);

    // Favicon with detailed error logging
    let favicon = match find_favicon(&document, &base_url) {
        Ok(Some(url)) => {
            info!("🎨 Found favicon: {}", url);
            Some(url)
        }
        Ok(None) => {
            warn!("⚠️ No favicon found");
            None
        }
        Err(e) => {
            error!("❌ Error finding favicon: {:?}", e);
            None
        }
    };

    // OpenGraph image with logging
    let image = document
        .select(&Selector::parse("meta[property='og:image']").unwrap())
        .next()
        .and_then(|el| el.value().attr("content"))
        .map(|src| {
            info!("🖼️ Found OpenGraph image: {}", src);
            resolve_url(&base_url, src)
        })
        .transpose()?;

    let metadata = Metadata {
        title,
        description,
        favicon,
        image,
        url: url.to_string(),
    };

    info!("✨ Successfully built metadata: {:?}", metadata);
    Ok(metadata)
}

fn find_favicon(document: &Html, base_url: &Url) -> Result<Option<String>, Box<dyn std::error::Error>> {
    info!("🔍 Searching for favicon");
    
    let favicon_selectors = [
        "link[rel='icon']",
        "link[rel='shortcut icon']",
        "link[rel='apple-touch-icon']",
        "link[rel='apple-touch-icon-precomposed']",
    ];

    for selector in favicon_selectors {
        info!("👀 Trying selector: {}", selector);
        if let Some(favicon) = document
            .select(&Selector::parse(selector).unwrap())
            .next()
            .and_then(|el| el.value().attr("href"))
        {
            info!("✅ Found favicon with selector {}: {}", selector, favicon);
            if let Ok(absolute_url) = resolve_url(base_url, favicon) {
                return Ok(Some(absolute_url));
            }
        }
    }

    info!("ℹ️ Using fallback favicon.ico");
    Ok(Some(base_url.join("/favicon.ico")?.to_string()))
}

fn resolve_url(base: &Url, path: &str) -> Result<String, Box<dyn std::error::Error>> {
    info!("🔗 Resolving URL - Base: {}, Path: {}", base, path);
    let resolved = base.join(path)?.to_string();
    info!("✅ Resolved URL: {}", resolved);
    Ok(resolved)
}

pub fn routes() -> Router {
    Router::new()
        .route("/api/metadata", get(get_metadata))
}