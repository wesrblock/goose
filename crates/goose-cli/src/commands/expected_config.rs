// This is a temporary file to simulate some configuration data from the backend

use crate::profile::provider_helper::PROVIDER_OPEN_AI;

pub struct RecommendedModels {
    pub model: &'static str,
}
pub fn get_recommended_models(provider_name: &str) -> RecommendedModels {
    if provider_name == PROVIDER_OPEN_AI {
        RecommendedModels { model: "gpt-4o" }
    } else {
        RecommendedModels {
            model: "claude-3-5-sonnet-2",
        }
    }
}
