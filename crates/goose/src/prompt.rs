// prompt.rs

use std::collections::HashMap;
use std::fs;
use tera::{Context, Tera, Error as TeraError};
use std::path::PathBuf;

pub fn load_prompt(
    template: &str,
    context_params: &HashMap<String, String>,
) -> Result<String, TeraError> {
    // Create a Tera instance and add the template
    let mut tera = Tera::default();
    tera.add_raw_template("inline_template", template)?;

    // Create a context and insert variables
    let mut context = Context::new();
    for (key, value) in context_params {
        context.insert(key, value);
    }

    // Render the template
    let rendered = tera.render("inline_template", &context)?;
    Ok(rendered)
}


pub fn load_prompt_file(
    template_file: impl Into<PathBuf>,
    context_params: &HashMap<String, String>,
) -> Result<String, TeraError> {
    // Convert to PathBuf and read the template file content
    let file_path = template_file.into();
    let template_content = fs::read_to_string(file_path)
        .map_err(|e| TeraError::chain("Failed to read template file", e))?;

    // Use the same function to render
    load_prompt(&template_content, context_params)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

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
        let context = HashMap::new();

        let result = load_prompt_file(file_path, &context);
        assert!(result.is_err());
    }
}
