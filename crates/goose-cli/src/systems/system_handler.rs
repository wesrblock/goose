use serde_json::Value;

pub async fn fetch_system(url: &str) -> Result<Option<String>, Box<dyn std::error::Error>> {
    let full_url = format!("{}/fetch_name", url);
    match reqwest::get(full_url).await {
        Ok(response) => match response.json::<Value>().await {
            Ok(json) => {
                if let Some(name) = json.get("name").and_then(|n| n.as_str()) {
                    return Ok(Some(name.to_string()));
                } else {
                    println!("No 'name' field in the JSON response.");
                }
            }
            Err(err) => {
                println!("Failed to parse JSON: {}", err);
            }
        },
        Err(err) => {
            println!("Failed to fetch URL: {}", err);
        }
    }
    Ok(None)
}