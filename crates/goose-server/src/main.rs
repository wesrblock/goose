mod configuration;
mod error;
mod routes;
mod state;

use tower_http::cors::{Any, CorsLayer};
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing for logging
    tracing_subscriber::fmt::init();

    // Load configuration
    let settings = configuration::Settings::new()?;

    // Create app state
    let state = state::AppState {
        provider_config: settings.provider.into_config(),
    };

    // Create router with CORS support
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = routes::configure(state).layer(cors);

    // Run server
    let listener = tokio::net::TcpListener::bind(settings.server.socket_addr()).await?;
    info!("listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;
    Ok(())
}
