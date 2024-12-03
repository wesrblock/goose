use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use anyhow::Result;

/// Represents a resource in the system with its content and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resource {
    /// Path to the resource
    pub path: PathBuf,
    /// Content of the resource
    pub content: String,
    /// Last modified timestamp
    pub timestamp: DateTime<Utc>,
    /// Priority of the resource (higher number means higher priority)
    pub priority: i32,
}

impl Resource {
    /// Creates a new Resource with the given path
    /// Automatically loads content if the path exists
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref().to_path_buf();
        let content = if path.exists() {
            fs::read_to_string(&path)?
        } else {
            String::new()
        };
        
        Ok(Self {
            path,
            content,
            timestamp: Utc::now(),
            priority: 0,
        })
    }

    /// Creates a new Resource with explicit content
    pub fn with_content<P: AsRef<Path>, S: Into<String>>(
        path: P,
        content: S,
        priority: i32,
    ) -> Self {
        Self {
            path: path.as_ref().to_path_buf(),
            content: content.into(),
            timestamp: Utc::now(),
            priority,
        }
    }

    /// Updates the content of the resource
    pub fn update_content<S: Into<String>>(&mut self, content: S) {
        self.content = content.into();
        self.timestamp = Utc::now();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    use std::io::Write;

    #[test]
    fn test_new_resource_with_existing_file() -> Result<()> {
        let mut temp_file = NamedTempFile::new()?;
        writeln!(temp_file, "test content")?;
        
        let resource = Resource::new(temp_file.path())?;
        assert_eq!(resource.content.trim(), "test content");
        assert_eq!(resource.path, temp_file.path());
        assert_eq!(resource.priority, 0);
        
        Ok(())
    }

    #[test]
    fn test_new_resource_with_nonexistent_file() -> Result<()> {
        let path = PathBuf::from("nonexistent.txt");
        let resource = Resource::new(path.clone())?;
        
        assert!(resource.content.is_empty());
        assert_eq!(resource.path, path);
        assert_eq!(resource.priority, 0);
        
        Ok(())
    }

    #[test]
    fn test_resource_with_content() {
        let path = PathBuf::from("test.txt");
        let resource = Resource::with_content(&path, "custom content", 5);
        
        assert_eq!(resource.content, "custom content");
        assert_eq!(resource.path, path);
        assert_eq!(resource.priority, 5);
    }

    #[test]
    fn test_update_content() {
        let path = PathBuf::from("test.txt");
        let mut resource = Resource::with_content(&path, "initial", 1);
        let initial_timestamp = resource.timestamp;
        
        // Wait a moment to ensure timestamp changes
        std::thread::sleep(std::time::Duration::from_millis(1));
        
        resource.update_content("updated");
        
        assert_eq!(resource.content, "updated");
        assert!(resource.timestamp > initial_timestamp);
    }
}