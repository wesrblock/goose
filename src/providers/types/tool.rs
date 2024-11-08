use std::collections::HashMap;
use std::fmt::Debug;

/// A tool that can be used by a model.
pub struct Tool {
    /// The name of the tool
    pub name: String,
    /// A description of what the tool does
    pub description: String,
    /// A json schema of the function signature
    pub parameters: HashMap<String, serde_json::Value>,
    /// The function that powers the tool
    /// Note: We use Box<dyn Fn> to store callable functions
    pub function:
        Box<dyn Fn(&serde_json::Value) -> anyhow::Result<serde_json::Value> + Send + Sync>,
}

impl Tool {
    pub fn new(
        name: String,
        description: String,
        parameters: HashMap<String, serde_json::Value>,
        function: impl Fn(&serde_json::Value) -> anyhow::Result<serde_json::Value>
            + Send
            + Sync
            + 'static,
    ) -> Self {
        Tool {
            name,
            description,
            parameters,
            function: Box::new(function),
        }
    }
}

impl Debug for Tool {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Tool")
            .field("name", &self.name)
            .field("description", &self.description)
            .field("parameters", &self.parameters)
            .field("function", &"<function>")
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // Helper function to simulate your Python weather function
    fn get_current_weather(params: &serde_json::Value) -> anyhow::Result<serde_json::Value> {
        // In a real implementation, this would actually fetch weather
        Ok(json!({ "location": params["location"], "temperature": 72 }))
    }

    #[test]
    fn test_basic_tool_creation() {
        let parameters = HashMap::from([(
            "location".to_string(),
            json!({
                "type": "string",
                "description": "The city and state, e.g. San Francisco, CA"
            }),
        )]);

        let tool = Tool::new(
            "get_current_weather".to_string(),
            "Get the current weather in a given location".to_string(),
            parameters.clone(),
            get_current_weather,
        );

        assert_eq!(tool.name, "get_current_weather");
        assert_eq!(
            tool.description,
            "Get the current weather in a given location"
        );
        assert_eq!(tool.parameters, parameters);

        // Test function execution
        let result = (tool.function)(&json!({"location": "Chicago, IL"})).unwrap();
        assert_eq!(result.get("temperature").unwrap(), 72);
        assert_eq!(result.get("location").unwrap(), "Chicago, IL");
    }

    #[test]
    fn test_tool_with_multiple_params() {
        let parameters = HashMap::from([
            (
                "param1".to_string(),
                json!({
                    "type": "integer",
                    "description": "Description for param1"
                }),
            ),
            (
                "param2".to_string(),
                json!({
                    "type": "string",
                    "description": "Description for param2"
                }),
            ),
        ]);

        let tool = Tool::new(
            "multi_param_function".to_string(),
            "A function with multiple parameters".to_string(),
            parameters.clone(),
            |params| Ok(json!({ "received": params })),
        );

        assert_eq!(tool.parameters, parameters);

        // Test function execution with multiple parameters
        let test_params = json!({
            "param1": 42,
            "param2": "test"
        });
        let result = (tool.function)(&test_params).unwrap();
        assert_eq!(result.get("received"), Some(&test_params));
    }

    #[test]
    fn test_tool_debug_output() {
        let tool = Tool::new(
            "test_tool".to_string(),
            "Test description".to_string(),
            HashMap::new(),
            |_| Ok(json!({})),
        );

        let debug_output = format!("{:?}", tool);
        assert!(debug_output.contains("test_tool"));
        assert!(debug_output.contains("Test description"));
        assert!(debug_output.contains("<function>"));
    }
}
