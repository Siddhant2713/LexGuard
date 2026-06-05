#!/usr/bin/env python3
"""Start backend (uvicorn) and frontend (next dev) together."""

import os
import signal
import subprocess
import sys
import threading

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT, "backend")
FRONTEND_DIR = os.path.join(ROOT, "frontend")

RESET = "\033[0m"
COLORS = {
    "backend":  "\033[36m",   # cyan
    "frontend": "\033[35m",   # magenta
    "info":     "\033[33m",   # yellow
}


def stream(proc: subprocess.Popen, label: str) -> None:
    color = COLORS.get(label, "")
    assert proc.stdout is not None
    for raw in iter(proc.stdout.readline, b""):
        sys.stdout.write(f"{color}[{label}]{RESET} {raw.decode(errors='replace')}")
        sys.stdout.flush()


def main() -> None:
    # Check that the venv / node_modules exist so errors are clear
    venv_python = os.path.join(BACKEND_DIR, ".venv", "bin", "python")
    python_bin = venv_python if os.path.exists(venv_python) else sys.executable

    print(f"{COLORS['info']}[dev]{RESET} Starting backend  → http://localhost:8000")
    print(f"{COLORS['info']}[dev]{RESET} Starting frontend → http://localhost:3000")
    print(f"{COLORS['info']}[dev]{RESET} Press Ctrl+C to stop both\n")

    backend = subprocess.Popen(
        [python_bin, "-m", "uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"],
        cwd=BACKEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    frontend = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=FRONTEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    processes = [backend, frontend]

    threading.Thread(target=stream, args=(backend, "backend"), daemon=True).start()
    threading.Thread(target=stream, args=(frontend, "frontend"), daemon=True).start()

    def shutdown():
        print(f"\n{COLORS['info']}[dev]{RESET} Shutting down…")
        for p in processes:
            p.terminate()
        for p in processes:
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()
        sys.exit(0)

    signal.signal(signal.SIGINT, lambda *_: shutdown())
    signal.signal(signal.SIGTERM, lambda *_: shutdown())

    # Exit if either process dies unexpectedly
    while True:
        for p in processes:
            if p.poll() is not None:
                label = "backend" if p is backend else "frontend"
                print(f"{COLORS['info']}[dev]{RESET} {label} exited (code {p.returncode}), stopping all…")
                shutdown(None, None)
        import time
        time.sleep(1)


if __name__ == "__main__":
    main()
