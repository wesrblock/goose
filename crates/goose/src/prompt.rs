// prompt.rs

use std::fs;
use tera::{Context, Tera, Error as TeraError};
use std::path::PathBuf;
use serde::Serialize;

pub fn load_prompt<T: Serialize>(
    template: &str,
    context_data: &T,
) -> Result<String, TeraError> {
    let mut tera = Tera::default();
    tera.add_raw_template("inline_template", template)?;
    let context = Context::from_serialize(context_data)?;
    let rendered = tera.render("inline_template", &context)?;
    Ok(rendered)
}


pub fn load_prompt_file<T: Serialize>(
    template_file: impl Into<PathBuf>,
    context_data: &T,
    ) -> Result<String, TeraError> {
    let file_path = template_file.into();
    let template_content = fs::read_to_string(file_path)
        .map_err(|e| TeraError::chain("Failed to read template file", e))?;
    load_prompt(&template_content, context_data)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::collections::HashMap;
    use crate::tool::Tool;
    use serde_json::json;

    #[test]
    fn test_load_prompt() {
        let template = "Hello, {{ name }}! You are {{ age }} years old.";
        let mut context = HashMap::new();
        context.insert("name".to_string(), "Alice".to_string());
        context.insert("age".to_string(), 30.to_string());

        let result = load_prompt(template, &context).unwrap();
        assert_eq!(result, "Hello, Alice! You are 30 years old.");
    }

    #[test]
    fn test_load_prompt_missing_variable() {
        let template = "Hello, {{ name }}! You are {{ age }} years old.";
        let mut context = HashMap::new();
        context.insert("name".to_string(), "Alice".to_string());
        // 'age' is missing from context
        let result = load_prompt(template, &context);
        assert!(result.is_err());
    }

    #[test]
    fn test_load_prompt_file() {
        let template_content = "Hello, {{ name }}!";
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("test_template.txt");
        fs::write(&file_path, template_content).unwrap();

        let mut context = HashMap::new();
        context.insert("name".to_string(), "Bob".to_string());

        let result = load_prompt_file(file_path, &context).unwrap();
        assert_eq!(result, "Hello, Bob!");

        temp_dir.close().unwrap();
    }

    #[test]
    fn test_load_prompt_file_missing_file() {
        let file_path = PathBuf::from("non_existent_template.txt");
        let context: HashMap<String, String> = HashMap::new(); // Add type annotation here

        let result = load_prompt_file(file_path, &context);
        assert!(result.is_err());
    }

    #[test]
    fn test_load_prompt_with_tools() {
        let template = "### Tool Descriptions\n{% for tool in tools %}\n{{tool.name}}: {{tool.description}}\n{% endfor %}";

        let tools = vec![
            Tool::new(
                "calculator",
                "Performs basic math operations",
                json!({
                    "type": "object",
                    "properties": {
                        "operation": {"type": "string"},
                        "numbers": {"type": "array"}
                    }
                })
            ),
            Tool::new(
                "weather",
                "Gets weather information",
                json!({
                    "type": "object",
                    "properties": {
                        "location": {"type": "string"}
                    }
                })
            ),
        ];

        let mut context = HashMap::new();
        context.insert("tools".to_string(), tools);

        let result = load_prompt(template, &context).unwrap();
        let expected = "### Tool Descriptions\n\ncalculator: Performs basic math operations\n\nweather: Gets weather information\n";
        assert_eq!(result, expected);
    }

    #[test]
    fn test_load_prompt_with_empty_tools() {
        let template = "### Tool Descriptions\n{% for tool in tools %}\n{{tool.name}}: {{tool.description}}\n{% endfor %}";

        let tools: Vec<Tool> = vec![];
        let mut context = HashMap::new();
        context.insert("tools".to_string(), tools);

        let result = load_prompt(template, &context).unwrap();
        let expected = "### Tool Descriptions\n";
        assert_eq!(result, expected);
    }
}
