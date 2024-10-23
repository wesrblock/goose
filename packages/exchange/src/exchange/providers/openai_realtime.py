import os
import json
import re
import logging
import subprocess
from subprocess import PIPE, TimeoutExpired
from typing import Optional, Any, Dict, List, Tuple
from websocket import WebSocket
import websocket
from exchange.providers.base import Provider, Usage
from exchange.message import Message
from exchange.langfuse_wrapper import observe_wrapper
from exchange.providers.utils import openai_single_message_context_length_exceeded


class RealtimeWebSocket:
    """Handles streaming interactions with OpenAI's realtime websocket."""

    def __init__(self):
        """Initialize the WebSocket with default values."""
        self.ws: Optional[WebSocket] = None
        self._tool_call_count: int = 0
        self._max_tool_calls: int = 10
        self._current_tool_result: Optional[str] = None
        self._current_tool_call: Optional[dict] = None
        self.is_first_connection: bool = True

    @property
    def tool_call_count(self) -> int:
        return self._tool_call_count

    @tool_call_count.setter
    def tool_call_count(self, value: int):
        self._tool_call_count = value

    @property
    def max_tool_calls(self) -> int:
        return self._max_tool_calls

    @property
    def current_tool_call(self) -> Optional[dict]:
        return self._current_tool_call

    @current_tool_call.setter
    def current_tool_call(self, value: Optional[dict]):
        self._current_tool_call = value

    @property
    def current_tool_result(self) -> Optional[str]:
        return self._current_tool_result

    @current_tool_result.setter
    def current_tool_result(self, value: Optional[str]):
        self._current_tool_result = value

    def connect(self) -> bool:
        """Connect to the OpenAI realtime websocket."""
        url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview"
        headers = {
            "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",
            "OpenAI-Beta": "realtime=v1",
        }

        try:
            self.ws = websocket.create_connection(url, header=headers)
            self.ws.settimeout(60)  # 60 second timeout
            return True
        except Exception as e:
            logging.error(f"Failed to connect: {e}")
            return False

    def send_conversation_item(self, role: str, content: str) -> None:
        """Send an existing conversation message (using text type)."""
        self.ws.send(json.dumps({
            "type": "conversation.item.create",
            "item": {
                "type": "message",
                "role": role,
                "content": [{
                    "type": "input_text",
                    "text": content
                }]
            }
        }))

    def send_input_message(self, role: str, content: str) -> None:
        """Send a new input message (using input_text type)."""
        self.ws.send(json.dumps({
            "type": "conversation.item.create",
            "item": {
                "type": "message",
                "role": role,
                "content": [{
                    "type": "input_text",
                    "text": content
                }]
            }
        }))

    def cleanup(self):
        """Clean up the websocket connection and state."""
        if self.ws:
            try:
                self.ws.close()
            except Exception as e:
                logging.warning(f"Error during cleanup: {e}")
            finally:
                self.ws = None

        # Reset all state
        self.current_tool_result = None
        self.current_tool_call = None
        self.tool_call_count = 0
        self.is_first_connection = True

    def execute_tool(self, tool_call: dict) -> str:
        """Execute a tool call and return the result."""
        try:
            args = json.loads(tool_call["function"]["arguments"])
            if tool_call["function"]["name"] == "shell":
                command = args.get("command", "")
                try:
                    proc = subprocess.run(
                        command,
                        shell=True,
                        stdout=PIPE,
                        stderr=PIPE,
                        timeout=10,
                        text=True
                    )
                    result = proc.stdout if proc.returncode == 0 else f"Error: {proc.stderr}"
                except TimeoutExpired:
                    result = "Error: Command timed out after 10 seconds"
                except Exception as e:
                    result = f"Error executing command: {str(e)}"

                # Truncate long outputs
                if len(result) > 1000:  # Increased limit
                    lines = result.splitlines()[:15]  # Show more lines
                    result = "\n".join(lines) + "\n...(truncated for length)"

                return result
            return "Tool not implemented"

        except json.JSONDecodeError as e:
            return f"Error: Invalid tool arguments: {e}"
        except Exception as e:
            return f"Error executing tool: {str(e)}"

    def handle_message(self, message: str, history: Optional[List[Dict[str, Any]]] = None,
                      tools: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Handle a message exchange with tool integration."""

        try:
            if not self.ws or not self.ws.connected:
                if not self.connect():
                    raise RuntimeError("Failed to connect to websocket")

                # Send history first if we have it
                if history:
                    for hist_msg in history:
                        self.send_conversation_item(hist_msg["role"], hist_msg["content"][0]["text"])

            # Send the current message
            self.send_input_message("user", message)

            # Start the response
            self.ws.send(json.dumps({
                "type": "response.create",
                "response": {
                    "instructions": "You are a helpful AI assistant that can view files and edit code.",
                    "tools": tools if tools else []
                }
            }))

            content_text = ""
            tool_calls = []

            while True:
                try:
                    event = json.loads(self.ws.recv())
                except websocket.WebSocketTimeoutException:
                    # If we timeout, send what we have
                    break
                except json.JSONDecodeError as e:
                    logging.error(f"Invalid JSON received: {e}")
                    continue

                event_type = event.get("type")

                if event_type == "error":
                    self.cleanup()
                    raise RuntimeError(f"API Error: {event.get('error', '')}")

                elif event_type == "response.text.delta":
                    content_text += event.get("delta", "")

                elif event_type == "response.function_call_arguments.delta":
                    if not self.current_tool_call:
                        # Start new tool call
                        self.current_tool_call = {
                            "id": event.get("tool_call_id", f"call_{len(tool_calls)}"),
                            "type": "function",
                            "function": {
                                "name": event.get("function_name", ""),
                                "arguments": event.get("delta", "")
                            }
                        }
                    else:
                        # Add to existing call arguments
                        self.current_tool_call["function"]["arguments"] += event.get("delta", "")

                elif event_type == "response.function_call_arguments.done":
                    if self.current_tool_call:
                        # Execute the tool
                        result = self.execute_tool(self.current_tool_call)
                        
                        # Add the tool call and result
                        tool_calls.append(self.current_tool_call)

                        # Send back result and confirmation
                        self.send_input_message("tool", result)
                        self.send_input_message("assistant", f"I ran the command and got this output:\n{result}")

                        # Reset for next call
                        self.current_tool_call = None

                elif event_type == "response.done":
                    break

            # Format final response
            response = {
                "id": "rt_" + os.urandom(8).hex(),
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": content_text or "Let me know if you want to run any other commands.",
                    },
                    "finish_reason": "stop"
                }],
                "usage": {
                    "input_tokens": 0,  # Estimated
                    "completion_tokens": 0, 
                    "total_tokens": 0
                }
            }

            # Add tool calls if any were made
            if tool_calls:
                response["choices"][0]["message"]["tool_calls"] = tool_calls

            return response

        except Exception as e:
            self.cleanup()
            raise RuntimeError(f"Error in handle_message: {str(e)}")
        finally:
            self.cleanup()


class OpenAiRealtimeProvider(Provider):
    """Provider for OpenAI real-time chat completions."""

    PROVIDER_NAME: str = "openai-realtime"
    REQUIRED_ENV_VARS: list[str] = ["OPENAI_API_KEY"]

    def __init__(self):
        self.rtws = RealtimeWebSocket()

    @observe_wrapper()
    def complete(self,
                model: str,
                system: str,
                messages: list[Message],
                tools: tuple,
                **kwargs) -> tuple[Message, Usage]:
        """Complete the messages using the realtime websocket."""

        # Extract the text from messages
        content = messages[-1].content[0]
        if hasattr(content, "text"):
            text = content.text
        else:
            text = str(content)

        # Convert tools for the API
        tools_spec = [
            {
                "name": tool.name,
                "type": "function",
                "description": tool.description,
                "parameters": tool.parameters
            }
            for tool in tools
        ]

        # Get the history formatted for the API
        history = []
        for msg in messages[:-1]:
            if msg.content and (not history or history[-1]["role"] != msg.role):
                history.append({
                    "type": "message",
                    "role": msg.role,
                    "content": [{
                        "type": "input_text",
                        "text": msg.content[0].text
                    }]
                })

        response = self.rtws.handle_message(text, history=history, tools=tools_spec)
        openai_single_message_context_length_exceeded(response)

        # Convert the response back into a Message object
        message = self._response_to_message(response)

        # Estimated usage since the realtime API doesn't provide it
        usage = Usage(
            input_tokens=0,
            output_tokens=0,
            total_tokens=0
        )

        return message, usage

    def _response_to_message(self, response: dict) -> Message:
        """Convert the API response into a Message object."""
        from exchange.content import Text, ToolUse
        from exchange.message import Message

        content = []
        message_content = response["choices"][0]["message"].get("content")
        if message_content:
            content.append(Text(text=message_content))

        tool_calls = response["choices"][0]["message"].get("tool_calls")
        if tool_calls:
            content.extend([
                ToolUse(
                    id=tool["id"],
                    name=tool["function"]["name"],
                    parameters=json.loads(tool["function"]["arguments"])
                )
                for tool in tool_calls
            ])

        return Message(role="assistant", content=content)