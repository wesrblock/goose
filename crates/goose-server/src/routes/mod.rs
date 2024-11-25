// Export route modules
pub mod reply;
pub mod metadata; 

use axum::Router;
use crate::state::AppState;

// Function to configure all routes
pub fn configure(state: AppState) -> Router {
    Router::new().merge(reply::routes(state))
        .merge(metadata::routes())
}
