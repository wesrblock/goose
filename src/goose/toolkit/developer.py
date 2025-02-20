import os
import re
import tempfile
import httpx

from pathlib import Path

from exchange import Message
from goose.toolkit.base import Toolkit, tool
from goose.toolkit.utils import get_language, RULEPREFIX, RULESTYLE
from goose.utils.goosehints import fetch_goosehints
from goose.utils.shell import shell
from rich.markdown import Markdown
from rich.table import Table
from rich.rule import Rule


class Developer(Toolkit):
    """Provides a set of general purpose development capabilities

    The tools include plan management, a general purpose shell execution tool, and file operations.
    We also include some default shell strategies in the prompt, such as using ripgrep
    """

    def __init__(self, *args: object, **kwargs: dict[str, object]) -> None:
        super().__init__(*args, **kwargs)
        self.timestamps: dict[str, float] = {}
        self.cwd = os.getcwd()

    def system(self) -> str:
        """Retrieve system configuration details for developer"""
        system_prompt = Message.load("prompts/developer.jinja").text
        hints = fetch_goosehints()

        if hints:
            system_prompt = f"{system_prompt}\n\nHints:\n{hints}"
        return system_prompt

    @tool
    def update_plan(self, tasks: list[dict]) -> list[dict]:
        """
        Update the plan by overwriting all current tasks

        This can be used to update the status of a task. This update will be
        shown to the user directly, you do not need to reiterate it

        Args:
            tasks (list(dict)): The list of tasks, where each task is a dictionary
                with a key for the task "description" and the task "status". The status
                MUST be one of "planned", "complete", "failed", "in-progress".

        """
        # Validate the status of each task to ensure it is one of the accepted values.
        for task in tasks:
            if task["status"] not in {"planned", "complete", "failed", "in-progress"}:
                raise ValueError(f"Invalid task status: {task['status']}")

        # Create a table with columns for the index, description, and status of each task.
        table = Table(expand=True)
        table.add_column("#", justify="right", style="magenta")
        table.add_column("Task", justify="left")
        table.add_column("Status", justify="left")

        # Mapping of statuses to emojis for better visual representation in the table.
        emoji = {"planned": "⏳", "complete": "✅", "failed": "❌", "in-progress": "🕑"}
        for i, entry in enumerate(tasks):
            table.add_row(str(i), entry["description"], emoji[entry["status"]])

        # Log the table to display it directly to the user
        # `.log` method is used here to log the command execution in the application's UX
        self.notifier.log(table)

        # Return the tasks unchanged as the function's primary purpose is to update and display the task status.
        return tasks

    @tool
    def fetch_web_content(self, url: str) -> str:
        """
        Fetch content from a URL using httpx.

        Args:
            url (str): url of the site to visit.
        Returns:
            (dict): A dictionary with two keys:
                - 'html_file_path' (str): Path to a html file which has the content of the page. It will be very large so use rg to search it or head in chunks. Will contain meta data and links and markup.
                - 'text_file_path' (str): Path to a plain text file which has the some of the content of the page. It will be large so use rg to search it or head in chunks. If content isn't there, try the html variant.
        """  # noqa
        friendly_name = re.sub(r"[^a-zA-Z0-9]", "_", url)[:50]  # Limit length to prevent filenames from being too long

        try:
            result = httpx.get(url, follow_redirects=True).text
            with tempfile.NamedTemporaryFile(delete=False, mode="w", suffix=f"_{friendly_name}.html") as tmp_file:
                tmp_file.write(result)
                tmp_text_file_path = tmp_file.name.replace(".html", ".txt")
                plain_text = re.sub(
                    r"<head.*?>.*?</head>|<script.*?>.*?</script>|<style.*?>.*?</style>|<[^>]+>",
                    "",
                    result,
                    flags=re.DOTALL,
                )  # Remove head, script, and style tags/content, then any other tags
                with open(tmp_text_file_path, "w") as text_file:
                    text_file.write(plain_text)
                return {"html_file_path": tmp_file.name, "text_file_path": tmp_text_file_path}
        except httpx.HTTPStatusError as exc:
            self.notifier.log(f"Failed fetching with HTTP error: {exc.response.status_code}")
        except Exception as exc:
            self.notifier.log(f"Failed fetching with error: {str(exc)}")

    @tool
    def patch_file(self, path: str, before: str, after: str) -> str:
        """Patch the file at the specified by replacing before with after

        Before **must** be present exactly once in the file, so that it can safely
        be replaced with after.

        Args:
            path (str): The path to the file, in the format "path/to/file.txt"
            before (str): The content that will be replaced
            after (str): The content it will be replaced with
        """
        self.notifier.status(f"editing {path}")
        _path = Path(path)
        language = get_language(path)

        content = _path.read_text()

        if content.count(before) > 1:
            raise ValueError("The before content is present multiple times in the file, be more specific.")
        if content.count(before) < 1:
            raise ValueError("The before content was not found in file, be careful that you recreate it exactly.")

        content = content.replace(before, after)
        _path.write_text(content)

        output = f"""
```{language}
{before}
```
->
```{language}
{after}
```
"""
        self.notifier.log(Rule(RULEPREFIX + path, style=RULESTYLE, align="left"))
        self.notifier.log(Markdown(output))
        return "Succesfully replaced before with after."

    @tool
    def read_file(self, path: str) -> str:
        """Read the content of the file at path

        Args:
            path (str): The destination file path, in the format "path/to/file.txt"
        """
        language = get_language(path)
        content = Path(path).expanduser().read_text()
        self.notifier.log(Markdown(f"```\ncat {path}\n```"))
        # Record the last read timestamp
        self.timestamps[path] = os.path.getmtime(path)
        return f"```{language}\n{content}\n```"

    @tool
    def shell(self, command: str) -> str:
        """
        Execute a command on the shell

        This will return the output and error concatenated into a single string, as
        you would see from running on the command line. There will also be an indication
        of if the command succeeded or failed.

        Args:
            command (str): The shell command to run. It can support multiline statements
                if you need to run more than one at a time
        """
        # Log the command being executed in a visually structured format (Markdown).
        self.notifier.log(Rule(RULEPREFIX + "shell", style=RULESTYLE, align="left"))
        self.notifier.log(Markdown(f"```bash\n{command}\n```"))
        return shell(command, self.notifier, self.exchange_view)

    @tool
    def write_file(self, path: str, content: str) -> str:
        """
        Write a file at the specified path with the provided content. This will create any directories if they do not exist.
        The content will fully overwrite the existing file.

        Args:
            path (str): The destination file path, in the format "path/to/file.txt"
            content (str): The raw file content.
        """  # noqa: E501
        self.notifier.status("writing file")
        # Get the programming language for syntax highlighting in logs
        language = get_language(path)
        md = f"```{language}\n{content}\n```"

        # Log the content that will be written to the file
        # .log` method is used here to log the command execution in the application's UX
        # this method is dynamically attached to functions in the Goose framework
        self.notifier.log(Rule(RULEPREFIX + path, style=RULESTYLE, align="left"))
        self.notifier.log(Markdown(md))

        _path = Path(path)
        if path in self.timestamps:
            last_read_timestamp = self.timestamps.get(path, 0.0)
            current_timestamp = os.path.getmtime(path)
            if current_timestamp > last_read_timestamp:
                raise RuntimeError(
                    f"File '{path}' has been modified since it was last read."
                    + " Read the file to incorporate changes or update your plan."
                )

        # Prepare the path and create any necessary parent directories
        _path.parent.mkdir(parents=True, exist_ok=True)

        # Write the content to the file
        _path.write_text(content)

        # Update the last read timestamp after writing to the file
        self.timestamps[path] = os.path.getmtime(path)

        # Return a success message
        return f"Successfully wrote to {path}"
