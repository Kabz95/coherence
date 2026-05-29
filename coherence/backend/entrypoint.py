from __future__ import annotations

import os
import subprocess
import sys


def main() -> int:
    if os.getenv("JOB_KIND"):
        return subprocess.call([sys.executable, "worker.py"])

    return subprocess.call(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", os.getenv("PORT", "8080")]
    )


if __name__ == "__main__":
    raise SystemExit(main())
