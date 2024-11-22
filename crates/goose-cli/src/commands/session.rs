use rand::{distributions::Alphanumeric, Rng};
use std::path::PathBuf;

use goose::agent::Agent;
use goose::models::message::Message;
use goose::providers::factory;

use crate::commands::expected_config::get_recommended_models;
use crate::profile::profile::Profile;
use crate::profile::profile_handler::{load_profiles, PROFILE_DEFAULT_NAME};
use crate::profile::provider_helper::set_provider_config;
use crate::profile::provider_helper::PROVIDER_OPEN_AI;
use crate::prompt::cliclack::CliclackPrompt;
use crate::prompt::prompt::Prompt;
use crate::prompt::rustyline::RustylinePrompt;
use crate::session::session::Session;
use crate::session::session_file::ensure_session_dir;

pub fn build_session<'a>(session: Option<String>, profile: Option<String>, resume: bool) -> Box<Session<'a>> {
    let session_dir = ensure_session_dir().expect("Failed to create session directory");

    let session_name = if session.is_none() && !resume {
        generate_new_session_name(&session_dir)
    } else {
        session_name_or_rand(session.clone())
    };
    let session_file = session_dir.join(format!("{}.jsonl", session_name));

    // Guard against resuming a non-existent session
    if resume && !session_file.exists() {
        panic!("Cannot resume session: file {} does not exist", session_file.display());
    }

    // Guard against running a new session with a file that already exists
    if !resume && session_file.exists() {
        panic!("Session file {} already exists. Use --resume to continue an existing session", session_file.display());
    }

    let loaded_profile = load_profile(profile);

    // TODO: Reconsider fn name as we are just using the fn to ask the user if env vars are not set
    let provider_config =
        set_provider_config(&loaded_profile.provider, loaded_profile.model.clone());

    // TODO: Odd to be prepping the provider rather than having that done in the agent?
    let provider = factory::get_provider(provider_config).unwrap();
    let agent = Box::new(Agent::new(provider));
    let mut prompt = match std::env::var("GOOSE_INPUT") {
        Ok(val) => match val.as_str() {
            "cliclack" => Box::new(CliclackPrompt::new()) as Box<dyn Prompt>,
            "rustyline" => Box::new(RustylinePrompt::new()) as Box<dyn Prompt>,
            _ => Box::new(RustylinePrompt::new()) as Box<dyn Prompt>,
        },
        Err(_) => Box::new(RustylinePrompt::new()),
    };

    prompt.render(Box::new(Message::assistant().with_text(format!(
        r#"Stretching wings...
    Provider: {}
    Model: {}
    Session file: {}"#,
        loaded_profile.provider,
        loaded_profile.model,
        session_file.display()
    ))));

    Box::new(Session::new(agent, prompt, session_file))
}

fn session_name_or_rand(session: Option<String>) -> String {
    match session {
        Some(name) => name.to_lowercase(),
        None => rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(8)
            .map(char::from)
            .collect::<String>()
            .to_lowercase(),
    }
}

// For auto-generated names, try up to 5 times to get a unique name
fn generate_new_session_name(session_dir: &PathBuf) -> String {
    let mut attempts = 0;
    let max_attempts = 5;

    loop {
        let generated_name = session_name_or_rand(None);
        let generated_file = session_dir.join(format!("{}.jsonl", generated_name));

        if !generated_file.exists() {
            break generated_name;
        }

        attempts += 1;
        if attempts >= max_attempts {
            panic!("Failed to generate unique session name after {} attempts", max_attempts);
        }
    }
}

fn load_profile(profile_name: Option<String>) -> Box<Profile> {
    let profiles = load_profiles().unwrap();
    let loaded_profile = if profiles.is_empty() {
        let recommended_models = get_recommended_models(PROVIDER_OPEN_AI);
        Box::new(Profile {
            provider: PROVIDER_OPEN_AI.to_string(),
            model: recommended_models.model.to_string(),
            additional_systems: Vec::new(),
        })
    } else {
        match profile_name {
            Some(name) => match profiles.get(name.as_str()) {
                Some(profile) => Box::new(profile.clone()),
                None => panic!("Profile '{}' not found", name),
            },
            None => match profiles.get(PROFILE_DEFAULT_NAME) {
                Some(profile) => Box::new(profile.clone()),
                None => panic!(
                    "No '{}' profile found. Run configure to create a profile.",
                    PROFILE_DEFAULT_NAME
                ),
            }, // Default to the first profile. TODO: Define a constant name for the default profile.
        }
    };
    loaded_profile
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    #[should_panic(expected = "Cannot resume session: file")]
    fn test_resume_nonexistent_session_panics() {
        let temp_dir = tempdir().unwrap();
        // Set session directory to our temp directory so we don't actually create it.
        std::env::set_var("GOOSE_SESSION_DIR", temp_dir.path());

        build_session(
            Some("nonexistent-session".to_string()),
            None,
            true
        );
    }
}
