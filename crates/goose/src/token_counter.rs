use tokenizers::tokenizer::Tokenizer;
use std::collections::HashMap;
use std::path::PathBuf;

pub struct TokenCounter {
    tokenizers: HashMap<String, Tokenizer>,
}


impl TokenCounter {
    // static method to get the tokenizer files directory
     fn tokenizer_files_dir() -> PathBuf {
        let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        path.push("../../tokenizer_files");
        path
    }

    pub fn new() -> Self {
        let mut tokenizers = HashMap::new();
        // Add debug logging to help diagnose file loading issues
        match Tokenizer::from_file(Self::tokenizer_files_dir().join("Xenova--gpt-4o/tokenizer.json")) {
            Ok(tokenizer) => {
                tokenizers.insert("gpt-4o".to_string(), tokenizer);
            }
            Err(e) => {
                eprintln!("Failed to load default tokenizer: {}", e);
            }
        }
        TokenCounter {
            tokenizers,
        }
    }

    pub fn add_tokenizer(&mut self, tokenizer_name: &str, tokenizer_path: &str) {
        if let Ok(tokenizer) = Tokenizer::from_file(Self::tokenizer_files_dir().join(tokenizer_path)) {
            self.tokenizers.insert(tokenizer_name.to_string(), tokenizer);
        }
    }

    pub fn count_tokens(&self, model_name: &str, text: &str) -> Option<usize> {
        // TODO: this logic can be improved
        // map model names to tokenizer keys
        let tokenizer_key = if model_name.starts_with("claude") {
            "claude"
        } else {
            "gpt-4o"
        };

        // Try to get the tokenizer and encode the text
        if let Some(tokenizer) = self.tokenizers.get(tokenizer_key) {
            if let Ok(encoding) = tokenizer.encode(text, false) {
                return Some(encoding.len());
            }
        }

        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_count_tokens() {
        let mut counter = TokenCounter::new();

        // Use absolute path for test tokenizer
        counter.add_tokenizer("claude", "Xenova--claude-tokenizer/tokenizer.json");

        let text = "Hey there!";

        // Add debug print
        let count = counter.count_tokens("claude-3-5-sonnet-2", text);
        println!("Token count for '{}': {:?}", text, count);

        assert!(count.is_some(), "Tokenizer should return a count");
        assert_eq!(count.unwrap(), 3);
    }

    // Update the default tokenizer test similarly
    #[test]
    fn test_default_tokenizer() {
        let mut counter = TokenCounter::new();

        // Explicitly load the default tokenizer for testing
        counter.add_tokenizer("gpt-4o", "Xenova--gpt-4o/tokenizer.json");

        let text = "Hello, how are you?";
        let count = counter.count_tokens("gpt-4o-mini", text);

        println!("Token count for '{}': {:?}", text, count);
        assert!(count.is_some(), "Default tokenizer should return a count");
        assert_eq!(count.unwrap(), 6);
    }

    #[test]
    fn test_unknown_model() {
        let counter = TokenCounter::new();
        let count = counter.count_tokens("unknown-model", "Hey there!");
        assert_eq!(count.unwrap(), 3);
    }
}
