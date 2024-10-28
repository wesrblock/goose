from goose.notifier import Notifier
from rich.prompt import Confirm

def confirm_execute(ask_confirmation: bool, notifier: Notifier, change: str) -> bool:
    if ask_confirmation:
        notifier.stop()
        confirmation_result = Confirm.ask(f"Would like to continue to {change}?")
        notifier.stop()
        return confirmation_result
    return False

def cancel_confirmation(change: str) -> str:
    return f"{change} cancelled by the user."
