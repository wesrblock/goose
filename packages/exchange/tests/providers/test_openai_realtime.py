import json
import pytest
from exchange.providers.openai_realtime import RealtimeWebSocket, OpenAiRealtimeProvider

def test_realtime_initialize():
    """Test that the realtime websocket can be initialized properly."""
    ws = RealtimeWebSocket()
    assert ws.is_first_connection
    assert ws.tool_call_count == 0
    assert ws.max_tool_calls == 10
    assert ws.current_tool_result is None

def test_realtime_state_management():
    """Test that state management works correctly."""
    ws = RealtimeWebSocket()
    
    # Test tool call count limits
    ws.tool_call_count = 9  # Near limit
    assert ws.tool_call_count < ws.max_tool_calls
    
    ws.tool_call_count = 10  # At limit
    assert ws.tool_call_count >= ws.max_tool_calls
    
    # Test tool result storage  
    result = "test output"
    ws.current_tool_result = result
    assert ws.current_tool_result == result
    
    # Clear result
    ws.current_tool_result = None
    assert ws.current_tool_result is None

def test_realtime_response_handling():
    """Test handling of tool call responses."""
    ws = RealtimeWebSocket()
    
    # Setup test message and tool call
    content_text = ""
    tool_calls = []

    # Test initial tool call delta
    should_end, text = ws._handle_event({
        "type": "response.function_call_arguments.delta",
        "tool_call_id": "test1",
        "function_name": "shell",
        "delta": '{"command": "ls -l"}'
    }, content_text, tool_calls)
    
    assert not should_end
    assert ws.current_tool_call is not None
    assert ws.current_tool_call["function"]["name"] == "shell"
    
    # Now test completion
    should_end, text = ws._handle_event({
        "type": "response.function_call_arguments.done",
        "tool_call_id": "test1" 
    }, text, tool_calls)
    
    assert not should_end
    assert len(tool_calls) == 1
    assert ws.current_tool_call is None  # Should be cleared
    assert ws.current_tool_result is not None  # Should have executed

    # Test normal text content
    should_end, text = ws._handle_event({
        "type": "response.text.delta",
        "delta": "The command output was: "
    }, text, tool_calls)

    assert not should_end
    assert text == "The command output was: "
    
def test_send_message_with_tool_chain():
    """Test the complete message sending flow with tool call."""
    ws = RealtimeWebSocket()
    
    # Mock websocket connection
    class MockWs:
        def __init__(self):
            self.sent_messages = []
            self.connected = True

        def send(self, msg):
            self.sent_messages.append(json.loads(msg))

        def recv(self):
            if len(self.sent_messages) == 1:
                # Return tool call request after first message
                return json.dumps({
                    "type": "response.function_call_arguments.delta",
                    "tool_call_id": "test1",
                    "function_name": "shell",
                    "delta": '{"command": "ls -l"}'
                })
            elif len(self.sent_messages) == 2:
                # Complete tool call 
                return json.dumps({
                    "type": "response.function_call_arguments.done",
                    "tool_call_id": "test1"
                })
            else:
                # Complete the response
                return json.dumps({
                    "type": "response.done"
                })

        def settimeout(self, timeout):
            pass

        def close(self):
            self.connected = False

    ws.ws = MockWs()
    
    # Send test message
    response = ws.send_message("Run ls command")
    
    # Verify tool call was executed and cleared properly  
    assert response["choices"][0]["message"]["tool_calls"]
    assert ws.current_tool_call is None  
    assert ws.tool_call_count == 0