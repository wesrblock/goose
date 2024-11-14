// This is a temporary file to simulate some configuration data from the backend
pub const DEFAULT_MODERATOR: &str = "synopsis";
pub const DEFAULT_TOOLKIT_NAME : &str = "synopsis";
pub const DEFAULT_PROVIDER_NAME : &str = "openai";

pub struct RecommendedModels {
    pub processor: &'static str,
    pub accelerator: &'static str,
}
pub fn get_recommended_models(provider_name: &str) -> RecommendedModels {
    match provider_name {
        "openai" => {
            RecommendedModels {
                processor: "gpt-4o",
                accelerator: "gpt-4o-mini",
            }
        },
        "databricks" => {
            RecommendedModels {
                processor: "claude-3-5-sonnet-2",
                accelerator: "claude-3-5-sonnet-2",
            }
        },
        _ => panic!("Invalid provider name"),
    }
}