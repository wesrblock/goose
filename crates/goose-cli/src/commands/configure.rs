use crate::commands::expected_config::{get_recommended_models, RecommendedModels};
use crate::inputs::inputs::{get_confirm, get_non_empty_user_input, get_user_input};
use crate::profile::profile::{AdditionalSystem, Profile};
use crate::profile::profile_handler::{find_existing_profile, profile_path, save_profile};
use crate::profile::provider_helper::{
    get_provider_type, select_provider_lists, set_provider_config, PROVIDER_OPEN_AI,
};
use cliclack::spinner;
use console::style;
use goose::providers::configs::ProviderConfig;
use goose::providers::factory;
use goose::providers::types::message::Message;
use std::error::Error;
use crate::systems::system_handler::fetch_system;

pub async fn handle_configure(provided_profile_name: Option<String>) -> Result<(), Box<dyn Error>> {
    cliclack::intro(style(" configure-goose ").on_cyan().black())?;
    println!("We are helping you configure your Goose CLI profile.");
    let profile_name = provided_profile_name
        .unwrap_or_else(|| get_user_input("Enter profile name:", "default").unwrap());
    let existing_profile_result = get_existing_profile(&profile_name);
    let existing_profile = existing_profile_result.as_ref();

    let provider_name = select_provider(existing_profile);
    let recommended_models = get_recommended_models(&provider_name);
    let processor = set_processor(existing_profile, &recommended_models)?;
    let accelerator = set_accelerator(existing_profile, &recommended_models)?;
    let provider_config = set_provider_config(&provider_name, processor.clone());
    let mut additional_systems = existing_profile.map_or(Vec::new(), |profile| {
        profile.additional_systems.clone()
    });
    set_systems(&mut additional_systems).await?;
    let profile = Profile {
        provider: provider_name.to_string(),
        processor: processor.clone(),
        accelerator,
        additional_systems,
    };
    match save_profile(profile_name.as_str(), profile) {
        Ok(()) => println!("\nProfile saved to: {:?}", profile_path()?),
        Err(e) => println!("Failed to save profile: {}", e),
    }
    check_configuration(provider_name, provider_config).await?;
    Ok(())
}

async fn set_systems(additional_systems: &mut Vec<AdditionalSystem>) -> Result<(), Box<dyn Error>> {
    let mut systems_to_remove = Vec::new();
    for system in &mut *additional_systems {
        println!("System Name: {}, System Location: {}", system.name, system.location);
        if !get_confirm("keep this system?") {
            let remove_system = get_confirm("remove this system?");
            if remove_system {
                systems_to_remove.push(system.name.clone());
            }
        }
    }
    additional_systems.retain(|s| !systems_to_remove.contains(&s.name));
    loop {
        if !get_confirm("add more systems?") {
            break;
        }
        let additional_system_location;
        match get_non_empty_user_input(
            "Please enter the location of the system",
            "Please enter a valid location",
        ) {
            Ok(location) => additional_system_location = location,
            Err(_) => {
                continue;
            }
        }
        let system_name = fetch_system(additional_system_location.as_str()).await?;
        if system_name.is_none() {
            println!("System not found. Please enter a valid system location.");
            continue;
        }
        let additional_system = AdditionalSystem {
            name: system_name.unwrap(),
            location: additional_system_location,
        };
        additional_systems.push(additional_system);
    }
    Ok(())
}

async fn check_configuration(
    provider_name: &str,
    provider_config: ProviderConfig,
) -> Result<(), Box<dyn Error>> {
    let spin = spinner();
    spin.start("Now let's check your configuration...");
    let provider =
        factory::get_provider(get_provider_type(provider_name), provider_config).unwrap();
    let message = Message::user("Please give a nice welcome messsage (one sentence) and let them know they are all set to use this agent ").unwrap();
    let result = provider.complete(
                                   "You are an AI agent called Goose. You use tools of connected systems to solve problems.",
                                   &[message], &[]).await?;
    spin.stop(result.0.text());
    Ok(())
}

fn get_existing_profile(profile_name: &String) -> Option<Profile> {
    let existing_profile_result = find_existing_profile(profile_name.as_str());
    if existing_profile_result.is_some() {
        println!("Profile already exists. We are going to overwriting the existing profile...");
    } else {
        println!("We are creating a new profile...");
    }
    existing_profile_result
}

fn set_processor(
    existing_profile: Option<&Profile>,
    recommended_models: &RecommendedModels,
) -> Result<String, Box<dyn Error>> {
    let default_processor_value = existing_profile
        .map_or(recommended_models.processor, |profile| {
            profile.processor.as_str()
        });
    let processor = get_user_input("Enter processor:", default_processor_value)?;
    Ok(processor)
}

fn set_accelerator(
    existing_profile: Option<&Profile>,
    recommended_models: &RecommendedModels,
) -> Result<String, Box<dyn Error>> {
    let default_accelerator_value = existing_profile
        .map_or(recommended_models.accelerator, |profile| {
            profile.accelerator.as_str()
        });
    let processor = get_user_input("Enter accelerator:", default_accelerator_value)?;
    Ok(processor)
}

fn select_provider(existing_profile: Option<&Profile>) -> &str {
    let default_value =
        existing_profile.map_or(PROVIDER_OPEN_AI, |profile| profile.provider.as_str());
    cliclack::select("Select provider:")
        .initial_value(default_value)
        .items(&select_provider_lists())
        .interact()
        .unwrap()
}
