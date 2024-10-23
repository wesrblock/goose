# janky global state for now, think about it
from collections import defaultdict
import re
import subprocess
import os
from pathlib import Path
import tempfile
from typing import Dict, Literal, Optional
import shutil

from exchange import Message
import httpx
from goose.synopsis.system import system
from goose.toolkit.base import Toolkit, tool
from goose.toolkit.utils import RULEPREFIX, RULESTYLE, get_language
from goose.utils.shell import is_dangerous_command, shell, keep_unsafe_command_prompt
from rich.markdown import Markdown
from rich.rule import Rule

TextEditorCommand = Literal["view", "create", "str_replace", "insert", "undo_edit"]


class SynopsisDeveloper(Toolkit):
    """Provides shell and file operation tools using OperatingSystem."""

    def __init__(self, *args: object, **kwargs: Dict[str, object]) -> None:
        super().__init__(*args, **kwargs)
        self._file_history = defaultdict(list)

    def system(self) -> str:
        """Retrieve system configuration details for developer"""
        system_prompt = Message.load("developer.md").text
        return system_prompt

    def logshell(self, command: str, title: str = "shell") -> None:
        self.notifier.log("")
        self.notifier.log(
            Rule(RULEPREFIX + f"{title} | [dim magenta]{os.path.abspath(system.cwd)}[/]", style=RULESTYLE, align="left")
        )
        self.notifier.log(Markdown(f"```bash\n{command}\n```"))
        self.notifier.log("")

    @tool
    def source(self, path: str) -> str:
        """Source the file at path, keeping the updates reflected in future shell commands

        Args:
            path (str): The path to the file to source.
        """
        source_command = f"source {path} && env"
        self.logshell(f"source {path}")
        result = shell(source_command, self.notifier, self.exchange_view, cwd=system.cwd, env=system.env)
        env_vars = dict(line.split("=", 1) for line in result.splitlines() if "=" in line)
        system.env.update(env_vars)
        return f"Sourced {path}"

    @tool
    def shell(self, command: str) -> str:
        """Execute any command on the shell

        Args:
            command (str): The shell command to run. It can support multiline statements
                if you need to run more than one at a time
        """
        if command.startswith("cat"):
            raise ValueError("You must read files through the read_file tool.")
        if command.startswith("cd"):
            raise ValueError("You must change dirs through the change_dir tool.")
        if command.startswith("source"):
            raise ValueError("You must source files through the source tool.")

        self.logshell(command)
        return shell(command, self.notifier, self.exchange_view, cwd=system.cwd, env=system.env)

    def _write_file(self, path: str, content: str) -> str:
        """Write content to the file at path."""
        patho = system.to_patho(path)

        if patho.exists() and not system.is_active(path):
            print(f"We are warning the LLM to view before write in write_file, with path={path} and patho={str(patho)}")
            raise ValueError(f"You must view {path} using read_file before you overwrite it")

        self._save_file_history(patho)  # Save current content to history

        patho.parent.mkdir(parents=True, exist_ok=True)
        patho.write_text(content)
        system.remember_file(path)

        language = get_language(path)
        md = f"```{language}\n{content}\n```"

        self.notifier.log("")
        self.notifier.log(Rule(RULEPREFIX + path, style=RULESTYLE, align="left"))
        self.notifier.log(Markdown(md))
        self.notifier.log("")

        return f"Successfully wrote to {path}"

    def _patch_file(self, path: str, before: str, after: str) -> str:
        """Patch the file at the specified path by replacing 'before' with 'after'."""
        self.notifier.status(f"editing {path}")
        patho = system.to_patho(path)

        if not patho.exists():
            raise ValueError(f"You can't patch {path} - it does not exist yet")

        if not system.is_active(path):
            raise ValueError(f"You must view {path} using read_file before you patch it")

        language = get_language(path)

        content = patho.read_text()

        if content.count(before) > 1:
            raise ValueError("The before content is present multiple times in the file, be more specific.")
        if content.count(before) < 1:
            raise ValueError("The before content was not found in file, be careful that you recreate it exactly.")

        self._save_file_history(patho)  # Save current content to history

        content = content.replace(before, after)
        system.remember_file(path)
        patho.write_text(content)

        output = f"""
```{language}
{before}
```
->
```{language}
{after}
```
"""
        self.notifier.log("")
        self.notifier.log(Rule(RULEPREFIX + path, style=RULESTYLE, align="left"))
        self.notifier.log(Markdown(output))
        self.notifier.log("")
        return "Succesfully replaced before with after."

    def _save_file_history(self, patho: Path) -> None:
        """Save the current content of the file to history for undo functionality."""
        content = patho.read_text()
        self._file_history[str(patho)] = content

    def _undo_edit(self, path: str) -> str:
        """Undo the last edit made to a file."""
        patho = system.to_patho(path)

        if not patho.exists():
            raise ValueError(f"The file {path} does not exist.")

        if str(patho) not in self._file_history:
            raise ValueError(f"No edit history available to undo changes on {path}.")

        # Restore the previous content from history
        previous_content = self._file_history.pop(str(patho))
        patho.write_text(previous_content)

        # Remember the file in system
        system.remember_file(path)

        language = get_language(path)
        md_content = f"Undo edit for {path}."

        self.notifier.log("")
        self.notifier.log(Rule(RULEPREFIX + path, style=RULESTYLE, align="left"))
        self.notifier.log(Markdown(md_content))
        self.notifier.log("")

        return f"Successfully undid the last edit on {path}"

    @tool
    def text_editor(
        self,
        command: TextEditorCommand,
        path: str,
        file_text: Optional[str] = None,
        insert_line: Optional[int] = None,
        new_str: Optional[str] = None,
        old_str: Optional[str] = None,
        view_range: Optional[list[int]] = None,
    ) -> str:
        """
        Perform text editing operations on files.

        The `command` parameter specifies the operation to perform. Allowed options are:
        - `view`: View the content of a file or directory.
        - `create`: Create a new file with the given content.
        - `str_replace`: Replace a string in a file with a new string.
        - `insert`: Insert a string into a file after a specific line number.
        - `undo_edit`: Undo the last edit made to a file.

        Args:
            command (str): The commands to run. Allowed options are: `view`, `create`, `str_replace`, `insert`, `undo_edit`.
            path (str): Absolute path (or relative path against cwd) to file or directory, e.g. `/repo/file.py` or `/repo` or `curr_dir_file.py`.
            file_text (str, optional): Required parameter of `create` command, with the content of the file to be created.
            insert_line (int, optional): Required parameter of `insert` command. The `new_str` will be inserted AFTER the line `insert_line` of `path`.
            new_str (str, optional): Optional parameter of `str_replace` command containing the new string (if not given, no string will be added). Required parameter of `insert` command containing the string to insert.
            old_str (str, optional): Required parameter of `str_replace` command containing the string in `path` to replace.
            view_range (list, optional): Optional parameter of `view` command when `path` points to a file. If none is given, the full file is shown. If provided, the file will be shown in the indicated line number range, e.g. [11, 12] will show lines 11 and 12. Indexing at 1 to start. Setting `[start_line, -1]` shows all lines from `start_line` to the end of the file.
        """
        # Ensure 'command' is provided
        if not command:
            raise ValueError("Parameter 'command' is required.")

        # Ensure 'path' is provided
        if not path:
            raise ValueError("Parameter 'path' is required.")

        patho = system.to_patho(path)

        if command == "view":
            # View the content of the file or directory
            if patho.is_file():
                # Read the file content
                if not patho.exists():
                    raise ValueError(f"The file {path} does not exist.")

                with open(patho, "r") as f:
                    content = f.readlines()

                if view_range:
                    # Ensure view_range is a list of two integers
                    if len(view_range) != 2:
                        raise ValueError("view_range must be a list of two integers.")
                    start_line, end_line = view_range
                    if start_line < 1:
                        raise ValueError("Line numbers start from 1.")
                    if end_line == -1:
                        end_line = len(content)
                    elif end_line < start_line:
                        raise ValueError("end_line must be greater than or equal to start_line.")
                    content = content[start_line - 1 : end_line]

                # Remember the file in system
                system.remember_file(path)

                # Display the content
                language = get_language(path)
                md_content = f"```{language}\n{''.join(content)}\n```"

                self.notifier.log("")
                self.notifier.log(Rule(RULEPREFIX + path, style=RULESTYLE, align="left"))
                self.notifier.log(Markdown(md_content))
                self.notifier.log("")

                return f"Displayed content of {path}"

            elif patho.is_dir():
                # List the directory contents
                files = [str(p) for p in patho.iterdir()]
                dir_content = "\n".join(files)

                self.notifier.log("")
                self.notifier.log(Rule(RULEPREFIX + path, style=RULESTYLE, align="left"))
                self.notifier.log(Markdown(f"```\n{dir_content}\n```"))
                self.notifier.log("")

                return f"Displayed contents of directory {path}"
            else:
                raise ValueError(f"The path {path} does not exist.")

        elif command == "create":
            # Create a new file with the given content
            if file_text is None:
                raise ValueError("Parameter 'file_text' is required for 'create' command.")

            # Use the existing _write_file method
            return self._write_file(path, file_text)

        elif command == "str_replace":
            # Replace a string in a file with a new string
            if old_str is None:
                raise ValueError("Parameter 'old_str' is required for 'str_replace' command.")
            if new_str is None:
                new_str = ""  # If new_str not provided, remove old_str

            # Use the existing _patch_file method
            return self._patch_file(path, old_str, new_str)

        elif command == "insert":
            # Insert a string into the file after a specific line number
            if insert_line is None:
                raise ValueError("Parameter 'insert_line' is required for 'insert' command.")
            if new_str is None:
                raise ValueError("Parameter 'new_str' is required for 'insert' command.")

            # Ensure the file exists
            if not patho.exists():
                raise ValueError(f"The file {path} does not exist.")

            if not system.is_active(path):
                raise ValueError(f"You must view {path} using the 'view' command before you edit it.")

            self._save_file_history(patho)  # Save current content to history

            # Read the file content
            with open(patho, "r") as f:
                lines = f.readlines()

            if insert_line < 0 or insert_line > len(lines):
                raise ValueError("insert_line is out of range.")

            # Insert the new string after the specified line
            lines.insert(insert_line, new_str + "\n")  # Line numbers start from 0 in list indices

            # Write the updated content back to the file
            with open(patho, "w") as f:
                f.writelines(lines)

            # Remember the file in system
            system.remember_file(path)

            language = get_language(path)
            md_content = f"Inserted at line {insert_line + 1}:\n```{language}\n{new_str}\n```"

            self.notifier.log("")
            self.notifier.log(Rule(RULEPREFIX + path, style=RULESTYLE, align="left"))
            self.notifier.log(Markdown(md_content))
            self.notifier.log("")

            return f"Successfully inserted new_str into {path} after line {insert_line}"

        elif command == "undo_edit":
            # Undo the last edit made to a file
            return self._undo_edit(path)

        else:
            raise ValueError(f"Unknown command '{command}'.")

    @tool
    def start_process(self, command: str) -> int:
        """Start a background process running the specified command

        Use this exclusively for processes that you need to run in the background
        because they do not terminate, such as running a webserver.

        Args:
            command (str): The shell command to run
        """
        self.logshell(command, title="background")

        if is_dangerous_command(command):
            self.notifier.stop()
            if not keep_unsafe_command_prompt(command):
                raise RuntimeError(
                    f"The command {command} was rejected as dangerous by the user."
                    " Do not proceed further, instead ask for instructions."
                )
            self.notifier.start()

        process = subprocess.Popen(
            command,
            shell=True,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=system.cwd,
            env=system.env,
        )
        process_id = system.add_process(process)
        return process_id

    @tool
    def list_processes(self) -> Dict[int, str]:
        """List all running background processes with their IDs and commands."""
        processes = system.get_processes()
        process_list = "```\n" + "\n".join(f"id: {pid}, command: {cmd}" for pid, cmd in processes.items()) + "\n```"
        self.notifier.log("")
        self.notifier.log(Rule(RULEPREFIX + "processes", style=RULESTYLE, align="left"))
        self.notifier.log(Markdown(process_list))
        self.notifier.log("")
        return processes

    @tool
    def view_process_output(self, process_id: int) -> str:
        """View the output of a running background process

        Args:
            process_id (int): The ID of the process to view output.
        """
        self.notifier.log("")
        self.notifier.log(Rule(RULEPREFIX + "processes", style=RULESTYLE, align="left"))
        self.notifier.log(Markdown(f"```\nreading {process_id}\n```"))
        self.notifier.log("")
        output = system.view_process_output(process_id)
        return output

    @tool
    def cancel_process(self, process_id: int) -> str:
        """Cancel the background process with the specified ID.

        Args:
            process_id (int): The ID of the process to be cancelled.
        """
        result = system.cancel_process(process_id)
        self.logshell(f"kill {process_id}")
        if result:
            return f"process {process_id} cancelled"
        else:
            return f"no known process {process_id}"

    @tool
    def change_dir(self, path: str) -> str:
        """Change the directory to the specified path

        Args:
            path (str): The new dir path, in the format "path/to/dir"
        """
        patho = system.to_patho(path)
        if not patho.is_dir():
            raise ValueError(f"The directory {path} does not exist")
        if patho.resolve() < Path(os.getcwd()).resolve():
            raise ValueError("You can cd into subdirs but not above the directory where we started.")
        self.logshell(f"cd {path}")
        system.cwd = str(patho)
        return path

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
