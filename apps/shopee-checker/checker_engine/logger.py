import sys
from pathlib import Path
from loguru import logger
from checker_engine.config import LOGS_DIR

LOGS_DIR.mkdir(parents=True, exist_ok=True)

logger.remove()

# Terminal output with formatting
logger.add(
    sys.stdout,
    colorize=True,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO"
)

# File rotation logging
logger.add(
    LOGS_DIR / "checker_{time:YYYY-MM-DD}.log",
    rotation="00:00",
    retention="7 days",
    compression="zip",
    level="DEBUG",
    encoding="utf-8"
)

def get_logger():
    return logger
