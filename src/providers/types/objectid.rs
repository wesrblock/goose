use uuid::Uuid;

pub fn create_object_id(prefix: &str) -> String {
    format!("{}_{}", prefix, Uuid::new_v4().simple().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_object_id_format() {
        let id = create_object_id("test");
        assert!(id.starts_with("test_"), "ID should start with 'test_'");
        let expected_length = "test_".len() + 32;
        assert_eq!(id.len(), expected_length,
            "ID length should be {} (prefix + '_' + 32 char UUID)", expected_length);
    }

    #[test]
    fn test_create_object_id_uniqueness() {
        let id1 = create_object_id("test");
        let id2 = create_object_id("test");
        assert_ne!(id1, id2, "Generated IDs should be unique");
    }
}
