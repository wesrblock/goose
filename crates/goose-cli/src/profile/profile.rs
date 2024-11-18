use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[derive(Clone, Debug)]
pub struct Profile {
    pub provider: String,
    pub processor: String,
    pub accelerator: String,
}

#[derive(Serialize, Deserialize)]
pub struct Profiles {
    pub profile_items: std::collections::HashMap<String, Profile>
}
