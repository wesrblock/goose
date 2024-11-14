use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[derive(Clone, Debug)]
pub struct Profile {
    pub provider: String,
    pub processor: String,
    pub accelerator: String,
    pub moderator: String,
    pub toolkits: Vec<Toolkit>,
}

#[derive(Serialize, Deserialize)]
#[derive(Clone, Debug)]
pub struct Toolkit {
    pub name: String,
    pub requires: std::collections::HashMap<String, String>,
}

#[derive(Serialize, Deserialize)]
pub struct Profiles {
    pub profile_items: std::collections::HashMap<String, Profile>
}
