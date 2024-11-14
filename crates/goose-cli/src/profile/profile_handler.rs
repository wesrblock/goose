use std::collections::HashMap;
use std::error::Error;
use std::fs::{create_dir_all, File};
use std::io::Write;
use std::path::PathBuf;
use crate::profile::profile::Profile;

// TODO: set to profile1.yaml temporarily to avoid overriting the existing config
pub const PROFILE_CONFIG_PATH: &str = ".config/goose/profile1.yaml";

pub fn save_profile(profiles: &[HashMap<&str, &Profile>]) -> Result<(), Box<dyn Error>> {
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

pub fn create_profile(name: &str, profile: &Profile) -> Result<(), Box<dyn Error>> {
    let mut profile_map = HashMap::new();
    profile_map.insert(name, profile);
    save_profile(&[profile_map])?;
    Ok(())
}