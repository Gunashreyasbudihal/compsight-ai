#!/usr/bin/env python3
"""Run both FastAPI and Vite frontend concurrently."""

import subprocess
import sys


def main() -> None:
    fastapi_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.api:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd="C:\\Users\\Harsha S R\\OneDrive\\Desktop\\Compsight"
    )
    vite_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd="C:\\Users\\Harsha S R\\OneDrive\\Desktop\\Compsight\\frontend",
        shell=True
    )

    try:
        fastapi_proc.wait()
    except KeyboardInterrupt:
        pass
    finally:
        fastapi_proc.terminate()
        vite_proc.terminate()
        fastapi_proc.wait()
        vite_proc.wait()


if __name__ == "__main__":
    main()