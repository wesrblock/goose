use crate::profile::profile::Profile;
use std::collections::HashMap;
use std::error::Error;
use std::fs::{create_dir_all, File};
use std::io::Write;
use std::path::PathBuf;

// TODO: set to profile-1.0.yaml temporarily to avoid overriting the existing config
pub const PROFILE_CONFIG_PATH: &str = ".config/goose/profile-1.0.yaml";
pub const PROFILE_DEFAULT_NAME: &str = "default";

fn save_profiles_to_file(profiles: &HashMap<String, Profile>) -> Result<(), Box<dyn Error>> {
    let path = profile_path()?;

    if let Some(parent) = path.parent() {
        create_dir_all(parent)?;
    }

    let yaml_string = serde_yaml::to_string(profiles)?;
    let mut file = File::create(&path)?;
    file.write_all(yaml_string.as_bytes())?;
    Ok(())
}

pub fn profile_path() -> Result<PathBuf, Box<dyn Error>> {
    let mut path = dirs::home_dir().ok_or("Failed to find home directory")?;
    path.push(PROFILE_CONFIG_PATH);
    Ok(path)
}

pub fn save_profile(profile_name: &str, new_profile: Profile) -> Result<(), Box<dyn Error>> {
    let mut profiles = load_profiles().unwrap();
    profiles.insert(profile_name.to_string(), new_profile);
    let _ = save_profiles_to_file(&profiles);
    Ok(())
}

fn profile_file_exists() -> bool {
    profile_path().unwrap().exists()
}
pub fn load_profiles() -> Result<HashMap<String, Profile>, Box<dyn Error>> {
    let path = profile_path()?;
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let file = File::open(&path)?;
    match serde_yaml::from_reader(file) {
        Ok(profiles) => Ok(profiles),
        Err(e) => {
            eprintln!("\x1b[31mFailed to parse profile file: {}\n\nPlease delete {} and recreate it.\n\x1b[0m", e, path.display());
            Err(Box::new(e))
        }
    }
}

pub fn find_existing_profile(profile_name: &str) -> Option<Profile> {
    if profile_file_exists() {
        let profiles = load_profiles().unwrap();
        profiles.get(profile_name).cloned()
    } else {
        None
    }
}
