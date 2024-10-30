from datetime import datetime


def formatted_time(time: datetime, format: str = "%Y-%m-%d %H:%M:%S") -> str:
    return time.strftime(format)
