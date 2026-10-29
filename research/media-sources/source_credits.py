"""Use the same manifest attribution rules as the browser importer."""
import functools
import json
from pathlib import Path
import subprocess


@functools.lru_cache(maxsize=1)
def source_index():
    script = Path(__file__).with_name("build-source-index.mjs")
    result = subprocess.run(["node", "--experimental-strip-types", str(script)], check=True,
                            capture_output=True, text=True, encoding="utf-8")
    return json.loads(result.stdout)


def source_credit(path, digest):
    rows = source_index()
    match = next((row for row in rows if row["path"] == path and (not row.get("sha256") or row["sha256"] == digest)), None)
    if match is None:
        match = next((row for row in rows if row.get("sha256") == digest), None)
    if match is None:
        return {"type": "OTHER", "label": "Chưa xác minh nguồn", "url": None, "note": path}
    return {**match["source"], "note": (path + "\n" + match["source"].get("note", ""))[:2000]}
