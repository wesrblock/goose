use std::io::{self, Write};

use anyhow::Result;
use bat::PrettyPrinter;
use cliclack::{input, spinner};
use goose::providers::types::message::Message;

pub trait Prompt {
    fn render(&mut self, message: Box<Message>);
    fn get_input(&mut self) -> Result<Input>;
    fn show_busy(&self);
    fn hide_busy(&self);
    fn close(&self);
}

pub struct Input {
    pub input_type: InputType,
    pub content: Option<String>, // Optional content as sometimes the user may be issuing a command eg. (Exit)
}

pub enum InputType {
    Message, // User sent a message
    Exit,    // User wants to exit the session
}

pub struct CliclackPrompt {
    spinner: cliclack::ProgressBar,
}

impl CliclackPrompt {
    pub fn new() -> Self {
        CliclackPrompt { spinner: spinner() }
    }
}

impl Prompt for CliclackPrompt {
    fn render(&mut self, message: Box<Message>) {
        let content = message.summary();
        PrettyPrinter::new()
            .input_from_bytes(content.as_bytes())
            .language("markdown")
            .print()
            .unwrap();
        io::stdout().flush().expect("Failed to flush stdout");
    }

    fn show_busy(&self) {
        spinner().start("awaiting reply");
    }

    fn hide_busy(&self) {
        self.spinner.stop("");
    }

    fn get_input(&mut self) -> Result<Input> {
        let message_text: String = input("Message:").placeholder("").multiline().interact()?;
        if message_text.trim().eq_ignore_ascii_case("exit") {
            return Ok(Input {
                input_type: InputType::Exit,
                content: None,
            });
        } else {
            return Ok(Input {
                input_type: InputType::Message,
                content: Some(message_text.trim().to_string()),
            });
        }
    }

    fn close(&self) {
        // No cleanup required
    }
}
