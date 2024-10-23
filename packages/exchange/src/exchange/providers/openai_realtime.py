import os
import json
import re
import asyncio
import base64
import httpx
import websocket
from typing import Optional, Any, Dict, List, Tuple
from exchange.content import Text, ToolResult, ToolUse
from exchange.message import Message
from exchange.providers.base import Provider, Usage
from exchange.tool import Tool
from tenacity import retry, wait_fixed, stop_after_attempt
from exchange.providers.utils import retry_if_status, openai_single_message_context_length_exceeded
from exchange.langfuse_wrapper import observe_wrapper

class RealtimeWebSocket:
    def __init__(self):
        self.ws: Optional[websocket.WebSocket] = None
        self.pending_responses: Dict[str, List[Dict[str, Any]]] = {}
        self.current_response_id: Optional[str] = None
        self.is_first_connection: bool = True  # Track if this is the first connection
        self.session_state: Dict[str, Any] = {}  # Store session state
        self.tool_call_count: int = 0  # Track number of tool calls
        self.max_tool_calls: int = 10  # Maximum allowed tool calls per session
        self.current_tool_result: Optional[str] = None  # Store last tool result
        self.current_tool_id: Optional[str] = None  # Store last tool call ID
        
    def connect(self) -> bool:
        """Connect to the OpenAI realtime API."""
        url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"
        headers = {
            "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",
            "OpenAI-Beta": "realtime=v1",
        }
        
        try:
            self.ws = websocket.create_connection(url, header=headers)
            return True
        except Exception as e:
            print(f"Failed to connect: {e}")
            return False

    def send_message(
        self, 
        message: str, 
        history: Optional[List[Dict[str, Any]]] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        timeout: int = 60  # Add timeout parameter
    ) -> Dict[str, Any]:
        """Send a message and collect the response.
        
        Args:
            message: The current message to send
            history: Optional list of previous messages to include (for first connection)
            tools: Optional list of tools to enable
            timeout: Maximum seconds to wait for response (default 60)
        """
        try:
            # Set socket timeout
            if self.ws:
                self.ws.settimeout(timeout)

            if not self.ws or not self.ws.connected:
                if not self.connect():
                    raise RuntimeError("Failed to connect to websocket")
                else:
                    for hist_msg in history:
                        hist_event = {
                            "type": "conversation.item.create",
                            "item": hist_msg
                        }
                        self.ws.send(json.dumps(hist_event))

            # Create a new response
            response_create = {
                "type": "response.create",
                "response": {
                    "modalities": ["text"],
                    "instructions": "You are a helpful AI assistant that can view files and edit code."
                }
            }
            if tools:
                response_create["response"]["tools"] = tools

            # Send the current user message
            # Record any previous tool results before sending new message
            if self.current_tool_result is not None:
                print(f"DEBUG: Sending tool result: {self.current_tool_result}")
                result_event = {
                    "type": "conversation.item.create",
                    "item": {
                        "type": "message",
                        "role": "user",
                        "content": [{
                            "type": "input_text",
                            "text": f"Tool result:\n{self.current_tool_result}"
                        }]
                    }
                }
                self.ws.send(json.dumps(result_event))
                self.current_tool_result = None
                self.current_tool_id = None

            # Send the current user message
            message_event = {
                "type": "conversation.item.create",
                "item": {
                    "type": "message",
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": message}
                    ]
                }
            }

            self.ws.send(json.dumps(message_event))
            self.ws.send(json.dumps(response_create))

            # Collect response until done
            content_text = ""
            tool_calls = []
            current_tool_call = None

            start_time = asyncio.get_event_loop().time()

            while True:
                # Check timeout
                if asyncio.get_event_loop().time() - start_time > timeout:
                    raise TimeoutError("Response timeout exceeded")

                try:
                    raw_event = self.ws.recv()
                    event = json.loads(raw_event)
                    print(f"DEBUG: Received event type {event['type']}")
                except (websocket.WebSocketTimeoutException, json.JSONDecodeError) as e:
                    raise RuntimeError(f"WebSocket error: {str(e)}")

                if self.tool_call_count >= self.max_tool_calls:
                    print("DEBUG: Maximum tool calls reached, stopping interaction")
                    raise RuntimeError(f"Exceeded maximum tool calls ({self.max_tool_calls})")

                if event["type"] == "error":
                    raise RuntimeError(f"API Error: {event['error']}")

                elif event["type"] == "response.text.delta":
                    content_text += event["delta"]

                elif event["type"] == "response.function_call_arguments.delta":
                    if not current_tool_call:
                        # Start new tool call
                        tool_id = event.get("tool_call_id", f"call_{len(tool_calls)}")
                        self.tool_call_count += 1
                        print(f"DEBUG: Starting tool call #{self.tool_call_count}, id={tool_id}")
                        current_tool_call = {
                            "id": tool_id,
                            "type": "function",
                            "function": {
                                "name": event.get("function_name", "shell"),
                                "arguments": event["delta"]
                            }
                        }
                    else:
                        current_tool_call["function"]["arguments"] += event["delta"]

                elif event["type"] == "response.function_call_arguments.done":
                    if current_tool_call:
                        # Complete the current tool call
                        try:
                            args_str = current_tool_call["function"]["arguments"]
                            print(f"DEBUG: Validating tool call arguments: {args_str}")
                            json.loads(args_str)  # Validate JSON
                            print(f"DEBUG: Tool call #{self.tool_call_count} validated successfully")
                            # Store tool call ID and result for next response
                            self.current_tool_id = current_tool_call["id"]
                            args = json.loads(args_str)
                            if "command" in args and args["command"] == "ls":
                                # Capture shell output
                                try:
                                    import subprocess
                                    result = subprocess.check_output(["ls"]).decode()
                                    self.current_tool_result = result
                                except Exception as e:
                                    self.current_tool_result = str(e)
                            tool_calls.append(current_tool_call)
                        except json.JSONDecodeError:
                            print(f"DEBUG: Invalid JSON for tool call #{self.tool_call_count}")
                            current_tool_call["error"] = f"Invalid JSON arguments: {args_str}"
                            tool_calls.append(current_tool_call)
                        current_tool_call = None

                elif event["type"] == "response.done":
                    # Format final response
                    response = {
                        "id": "rt_" + os.urandom(8).hex(),
                        "choices": [{
                            "message": {
                                "role": "assistant",
                                "content": content_text if content_text else None,
                            },
                            "finish_reason": "stop"
                        }],
                        "usage": {
                            "prompt_tokens": None,
                            "completion_tokens": None,
                            "total_tokens": None
                        }
                    }

                    if tool_calls:
                        response["choices"][0]["message"]["tool_calls"] = tool_calls

                    return response

        except Exception as e:
            # Clean up on error
            if self.ws and self.ws.connected:
                try:
                    self.ws.close()
                except:
                    pass
                self.ws = None
            raise e

        return {}

    def close(self):
        """Close the websocket connection."""
        if self.ws:
            self.ws.close()
            self.ws = None

class OpenAiRealtimeProvider(Provider):
    """Provides chat completions for models hosted directly by OpenAI."""

    PROVIDER_NAME = "openai"
    REQUIRED_ENV_VARS = ["OPENAI_API_KEY"]
    instructions_url = "https://platform.openai.com/docs/api-reference/api-keys"

    def __init__(self, client: httpx.Client, rtws: RealtimeWebSocket) -> None:
        self.client = client        
        self.rtws = rtws

    @classmethod
    def from_env(cls: type["OpenAiRealtimeProvider"]) -> "OpenAiRealtimeProvider":
        cls.check_env_vars(cls.instructions_url)
        url = os.environ.get("OPENAI_HOST", "https://api.openai.com/")
        key = os.environ.get("OPENAI_API_KEY")

        client = httpx.Client(
            base_url=url + "v1/",
            auth=("Bearer", key),
            timeout=httpx.Timeout(60 * 10),
        )
        return cls(client, RealtimeWebSocket())

    @staticmethod
    def get_usage(data: dict) -> Usage:
        # Realtime API doesn't provide token counts, so estimate based on text length
        if data.get("choices") and data["choices"][0].get("message", {}).get("content"):
            content_len = len(data["choices"][0]["message"]["content"])
            # Rough estimate: 4 characters per token
            estimated_tokens = max(1, content_len // 4)
            return Usage(
                input_tokens=estimated_tokens,
                output_tokens=estimated_tokens,
                total_tokens=estimated_tokens * 2
            )
        return Usage(
            input_tokens=1,
            output_tokens=1,
            total_tokens=2
        )

    def tools_to_realtime_format(self, tools: tuple[Tool, ...]) -> list[dict]:
        """Convert tools to the realtime API format."""
        tools_list = []
        for tool in tools:
            tools_list.append({
                "type": "function",  # Current API only supports functions
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.parameters
            })
        return tools_list

    @observe_wrapper(as_type="generation")
    def complete(
        self,
        model: str,
        system: str,
        messages: list[Message],
        tools: tuple[Tool, ...],
        **kwargs: dict[str, any],
    ) -> tuple[Message, Usage]:
        # Convert tools to realtime format if any
        tools_spec = self.tools_to_realtime_format(tools) if tools else None

        # Find text content in any user message
        text = None
        for message in reversed(messages):
            if message.role != "user":
                continue
            for content in message.content:
                if isinstance(content, Text):
                    text = content.text
                    break
            if text:
                break
        
        if not text:
            raise ValueError("No text content in last message")

        # Convert history into format for realtime API
        history = []
        if len(messages) > 1:  # More than just the current message
            history = [
                {
                    "type": "message",
                    "role": msg.role,
                    "content": [
                        # Only include text content for now
                        {"type": "input_text", "text": msg.text} if msg.text else None
                    ] 
                }
                for msg in messages[:-1]  # All but the last message
                if msg.text  # Only include if has text
            ]

        # Send message and get response
        response = self.rtws.send_message(text, history=history, tools=tools_spec)

        # Check for context length exceeded error
        if isinstance(response, dict) and "error" in response and len(messages) == 1:
            openai_single_message_context_length_exceeded(response["error"])

        # Convert response to Message
        message = self._response_to_message(response)
        usage = self.get_usage(response)
        
        return message, usage

    def _response_to_message(self, response: dict) -> Message:
        """Convert realtime API response to Message format."""
        original = response["choices"][0]["message"]
        content = []
        
        # Handle text content
        text = original.get("content")
        if text:
            content.append(Text(text=text))

        # Handle tool calls
        tool_calls = original.get("tool_calls", [])
        for tool_call in tool_calls:
            try:
                function_name = tool_call["function"]["name"]
                if not re.match(r"^[a-zA-Z0-9_-]+$", function_name):
                    content.append(
                        ToolUse(
                            id=tool_call["id"],
                            name=function_name,
                            parameters=tool_call["function"]["arguments"],
                            is_error=True,
                            error_message=f"Invalid function name '{function_name}', must match [a-zA-Z0-9_-]+"
                        )
                    )
                else:
                    content.append(
                        ToolUse(
                            id=tool_call["id"],
                            name=function_name,
                            parameters=json.loads(tool_call["function"]["arguments"])
                        )
                    )
            except json.JSONDecodeError:
                content.append(
                    ToolUse(
                        id=tool_call["id"],
                        name=tool_call["function"]["name"],
                        parameters=tool_call["function"]["arguments"],
                        is_error=True,
                        error_message=f"Invalid tool parameters for id {tool_call['id']}: {tool_call['function']['arguments']}"
                    )
                )

        return Message(role="assistant", content=content)