use crate::profile::profile::Profile;
use cliclack::input;
use console::style;
use ctrlc;
use serde::{Deserialize, Serialize};
use std::error::Error;
use crate::profile::profile_handler::{create_profile, profile_path};

#[derive(Serialize, Deserialize)]
pub struct ConfigOptions {
    pub provider: Option<String>,
    pub host: Option<String>,
    pub token: Option<String>,
    pub processor: Option<String>,
    pub accelerator: Option<String>,
}

pub fn handle_configure(options: ConfigOptions) -> Result<(), Box<dyn Error>> {
    ctrlc::set_handler(move || {}).expect("setting Ctrl-C handler");
    
    cliclack::clear_screen()?;

    cliclack::intro(style(" create-app ").on_cyan().black())?;
    let provider = prompt(options.provider, "Enter provider name:");
    let host = prompt(options.host, "Enter host URL:");
    let token = prompt(options.token, "Enter token:");
    let processor = prompt(options.processor, "Enter processor:");
    let accelerator = prompt(options.accelerator, "Enter accelerator:");

    let profile = Profile {
        provider: Some(provider),
        processor: Some(processor),
        accelerator: Some(accelerator),
        moderator: None,
        toolkits: None,
    };
    match create_profile("default", &profile) {
        Ok(()) => println!("\nConfiguration saved to: {:?}", profile_path()?),
        Err(e) => println!("Failed to save configuration: {}", e),
    }
    Ok(())
}

// Helper function to prompt the user
fn prompt(value: Option<String>, message: &str) -> String {
    value.unwrap_or_else(|| {
        input(message)
            .interact()
            .expect("Failed to get input")
    })
}
