from typing import Callable
from functools import wraps

from exchange.observers.base import ObserverManager

def observe_wrapper(*args, **kwargs) -> Callable:
    """Decorator to wrap a function with all registered observer plugins, dynamically fetched."""
    def wrapper(func):
        @wraps(func)
        def dynamic_wrapped(*func_args, **func_kwargs):
            wrapped = func
            for observer in ObserverManager.get_instance()._observers:
                wrapped = observer.observe_wrapper(*args, **kwargs)(wrapped)
            return wrapped(*func_args, **func_kwargs)
        return dynamic_wrapped
    return wrapper