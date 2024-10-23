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
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Send a message and collect the response.
        
        Args:
            message: The current message to send
            history: Optional list of previous messages to include (for first connection)
            tools: Optional list of tools to enable
        """
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
        response_content = []
        tool_calls = []
        content_text = ""

        while True:
            raw_event = self.ws.recv()
            event = json.loads(raw_event)

            if event["type"] == "error":
                raise RuntimeError(f"API Error: {event['error']}")

            elif event["type"] == "response.text.delta":
                content_text += event["delta"]

            elif event["type"] == "response.function_call_arguments.delta":
                if not tool_calls or tool_calls[-1].get("completed"):
                    tool_calls.append({
                        "id": event.get("tool_call_id", f"call_{len(tool_calls)}"),
                        "type": "function",
                        "function": {
                            "name": "shell",  # Use valid tool name
                            "arguments": event["delta"]
                        },
                        "completed": False
                    })
                else:
                    tool_calls[-1]["function"]["arguments"] += event["delta"]

            elif event["type"] == "response.function_call_arguments.done":
                if tool_calls:
                    tool_calls[-1]["completed"] = True

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
                        "prompt_tokens": None,  # Realtime API doesn't provide token counts
                        "completion_tokens": None,
                        "total_tokens": None
                    }
                }

                if tool_calls:
                    response["choices"][0]["message"]["tool_calls"] = tool_calls

                return response

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