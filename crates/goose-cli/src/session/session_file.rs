use anyhow::Result;
use serde_json;
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;

use goose::models::message::Message;

pub fn ensure_session_dir() -> Result<PathBuf> {
    let home_dir =
        dirs::home_dir().ok_or_else(|| anyhow::anyhow!("Could not determine home directory"))?;
    let config_dir = home_dir.join(".config").join("goose").join("sessions");

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)?;
    }

    Ok(config_dir)
}

pub fn readable_session_file(session_file: &PathBuf) -> Result<File> {
    match fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(session_file)
    {
        Ok(file) => Ok(file),
        Err(e) => Err(anyhow::anyhow!("Failed to open session file: {}", e)),
    }
}

pub fn persist_messages(session_file: &PathBuf, messages: &[Message]) -> Result<()> {
    let file = fs::File::create(session_file)?; // Create or truncate the file
    persist_messages_internal(file, messages)
}

// TODO: Public for testing but ideally this would be private.
pub fn persist_messages_internal(session_file: File, messages: &[Message]) -> Result<()> {
    let mut writer = std::io::BufWriter::new(session_file);

    for message in messages {
        serde_json::to_writer(&mut writer, &message)?;
        writeln!(writer)?;
    }

    writer.flush()?;
    Ok(())
}
