"""Collect synthetic-only diagnostics and stop the exact trial executable."""
import argparse
import os
from pathlib import Path
import shutil
import signal
import time


def is_trial_process(directory, binary):
    try:
        command = (directory / "cmdline").read_bytes().split(b"\0")[0].decode()
        return bool(command) and Path(command).resolve() == binary
    except (OSError, UnicodeError):
        return False


def cleanup(output):
    output.mkdir(parents=True, exist_ok=True)
    log = Path.home() / ".cache/datalab/surya/llamacpp_server.log"
    if log.is_file():
        shutil.copyfile(log, output / "llamacpp-server.log")
    configured = os.environ.get("LLAMA_CPP_BINARY")
    if not configured:
        return
    binary = Path(configured).resolve()
    for directory in Path("/proc").iterdir():
        if not directory.name.isdigit() or not is_trial_process(directory, binary):
            continue
        pid = int(directory.name)
        try:
            os.kill(pid, signal.SIGTERM)
            time.sleep(0.5)
            if is_trial_process(directory, binary):
                os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    cleanup(parser.parse_args().output)
