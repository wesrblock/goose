use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct Profile {
    pub provider: Option<String>,
    pub processor: Option<String>,
    pub accelerator: Option<String>,
    pub moderator: Option<String>,
    pub toolkits: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize)]
pub struct Toolkit {
    pub name: Option<String>,
    pub attributes: Option<std::collections::HashMap<String, String>>,
}

#[derive(Serialize, Deserialize)]
pub struct Profiles {
    pub profile_items: std::collections::HashMap<String, Profile>
}
