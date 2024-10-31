"""Tracing utilities for debugging and profiling."""
import inspect
import sys
from typing import Any, Callable, Optional
from datetime import datetime
from pathlib import Path
from rich import print

_INDENT_LEVEL = 0
_PACKAGE_ROOT = str(Path(__file__).parent.parent)  # goose package root

def should_trace(filename: str, func_name: str) -> bool:
    """Determine if a function should be traced based on filename and name."""
    # Skip internal Python calls and test files
    if (func_name.startswith('__') or 
        'importlib' in filename or 
        'site-packages' in filename or
        'test_' in filename):
        return False
        
    # Only trace functions in our package
    return _PACKAGE_ROOT in filename

def format_args(frame: Any) -> str:
    """Format function arguments for display."""
    args = inspect.getargvalues(frame)
    if not args.args:
        return "()"
        
    parts = []
    for arg in args.args:
        if arg == 'self':  # Skip self for methods
            continue
        val = args.locals[arg]
        # Truncate long values
        val_str = str(val)
        if len(val_str) > 50:
            val_str = val_str[:47] + "..."
        parts.append(f"{arg}={val_str}")
        
    return f"({', '.join(parts)})"

def trace_function(frame: Any, event: str, arg: Any) -> Optional[Callable]:
    """Trace function for sys.settrace.
    
    Args:
        frame: The current stack frame
        event: The type of event ('call', 'line', 'return', etc)
        arg: Event-specific argument
        
    Returns:
        The trace function itself to continue tracing
    """
    global _INDENT_LEVEL
    
    code = frame.f_code
    func_name = code.co_name
    filename = code.co_filename
    
    if not should_trace(filename, func_name):
        return None
        
    timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]
    rel_filename = filename.replace(_PACKAGE_ROOT, 'goose')
    indent = "  " * _INDENT_LEVEL
    
    if event == 'call':
        args_str = format_args(frame)
        print(f"[dim]{timestamp}[/dim] [blue]TRACE[/blue] {indent}→ {func_name}{args_str} [{rel_filename}]")
        _INDENT_LEVEL += 1
    elif event == 'return':
        _INDENT_LEVEL = max(0, _INDENT_LEVEL - 1)
        ret_str = str(arg)
        if len(ret_str) > 50:
            ret_str = ret_str[:47] + "..."
        print(f"[dim]{timestamp}[/dim] [blue]TRACE[/blue] {indent}← {func_name} = {ret_str}")
        
    return trace_function

def enable_tracing() -> None:
    """Enable global function tracing."""
    sys.settrace(trace_function)

def disable_tracing() -> None:
    """Disable global function tracing."""
    sys.settrace(None)