"""Publish complete JSON documents without exposing partially written files."""

import json
import os
import tempfile
from pathlib import Path


def publish_json(target: Path, document: dict) -> None:
    content = json.dumps(document, separators=(",", ":"), allow_nan=False)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix=f".{target.name}.", suffix=".tmp", dir=target.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, target)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)
