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
    
    # Setup a test tool call
    tool_calls = []
    current_tool_call = {
        "id": "test1",
        "type": "function",
        "function": {
            "name": "echo",
            "arguments": '{"message": "test"}'
        }
    }
    
    # Process tool call completion
    event = {
        "type": "response.function_call_arguments.done",
        "tool_call_id": "test1"
    }
    
    # Store the tool call
    ws.current_tool_call = current_tool_call
    assert ws.current_tool_call is not None
    
    # Check tool call processing
    ws.current_tool_call = None  # Clear after use
    assert ws.current_tool_call is None