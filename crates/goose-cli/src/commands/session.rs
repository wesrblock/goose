use crate::profile::profile::Profile;
use crate::profile::provider_helper::set_provider_config;
use crate::session::Session;

use cliclack::input;

use goose::agent::Agent;
use goose::providers::factory;
use goose::providers::factory::ProviderType;

use crate::prompt::CliclackPrompt;

pub fn build_session<'a>(session_name: Option<String>, profile: Box<Profile>) -> Box<Session<'a>> {
    // TODO: Use session_name.
    let session_name =
        session_name.unwrap_or_else(|| input("Session name:").placeholder("").interact().unwrap());
    println!("TODO: Use session name: {}", session_name);

    // TODO: Reconsider fn name as we are just using the fn to ask the user if env vars are not set
    let provider_config = set_provider_config(&profile.provider, profile.processor.clone());

    // TODO: Odd to be prepping the provider rather than having that done in the agent?
    let provider =
        factory::get_provider(to_provider_type(&profile.provider), provider_config).unwrap();
    let agent = Box::new(Agent::new(provider));
    let prompt = Box::new(CliclackPrompt::new());

    Box::new(Session::new(agent, prompt))
}

fn to_provider_type(provider_name: &str) -> ProviderType {
    match provider_name.to_lowercase().as_str() {
        "openai" => ProviderType::OpenAi,
        "databricks" => ProviderType::Databricks,
        _ => panic!("Invalid provider name"),
    }
}
