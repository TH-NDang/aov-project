"""Write the reviewed fixed stats and effect gameplay of items (ADR-033) as correction drafts through the admin API.

Reads item-gameplay.json (or the file given with --file), compares every entry with the latest revision of the item of
the same code and, for those that differ, forks a CONTENT_CORRECTION draft, writes `stats` and `effects` into it and
publishes it only with --publish. Text, recipe and shop places are kept as they are. Nothing is written without
--apply. An item that already has an open draft is left alone.

The backend must know `effects` (ADR-033) before this runs: an older backend refuses the field.
Every write is appended to .local-state/item-gameplay.jsonl, so a run can be followed and undone.
Sign-in works as in correct-enchantments.py: the local stack as the other research tools, a deployed stack (an https
--backend) as the wiki-importer service account with WIKI_IMPORTER_CLIENT_SECRET set in the shell running it.
"""

import argparse
import copy
import importlib.util
import json
from pathlib import Path
import sys


HERE = Path(__file__).resolve().parent
STATE = HERE / ".local-state"
GAMEPLAY = HERE / "item-gameplay.json"

spec = importlib.util.spec_from_file_location("correct_enchantments", HERE / "correct-enchantments.py")
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)


def load_gameplay(path=GAMEPLAY):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 1:
        raise ValueError("Unknown item gameplay schema.")
    return data


def applied(content, entry):
    """The content with the entry's stats and effects; everything else is kept."""
    result = copy.deepcopy(content)
    result["stats"] = copy.deepcopy(entry["stats"])
    result["effects"] = copy.deepcopy(entry["effects"])
    return result


GRANT_DEFAULTS = {"value": None, "maxValue": None, "unit": None, "growth": None, "scalings": [], "cap": None,
                  "durationSeconds": None, "target": "SELF"}
EFFECT_DEFAULTS = {"activation": "PASSIVE", "unique": False, "cooldownSeconds": None, "maxStacks": None, "grants": []}


def number(value):
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else value


def normal(value):
    """A value where 10 and 10.0 compare equal and absent fields read as the backend fills them."""
    if isinstance(value, dict):
        return {key: normal(item) for key, item in sorted(value.items())}
    if isinstance(value, list):
        return [normal(item) for item in value]
    return number(value)


def comparable(content):
    """What this tool may change: the fixed stats and the effects, in the form the backend returns them."""
    stats = [{"key": stat["key"], "value": stat["value"], "unit": stat.get("unit")} for stat in content.get("stats", [])]
    effects = []
    for effect in content.get("effects") or []:
        filled = {**EFFECT_DEFAULTS, **{key: item for key, item in effect.items() if item is not None}}
        filled["grants"] = [{**GRANT_DEFAULTS, **{key: item for key, item in grant.items() if item is not None}}
                            for grant in effect.get("grants") or []]
        effects.append(filled)
    return normal({"stats": stats, "effects": effects})


def plan(listed, gameplay):
    """Which items change, which already match, which are busy with a draft, which codes are unknown."""
    by_code = {row["code"]: row for row in listed}
    result = {"change": [], "same": [], "busy": [], "unknown": []}
    for code, entry in gameplay["items"].items():
        row = by_code.get(code)
        if row is None:
            result["unknown"].append(code)
        elif row["revision"]["state"] == "DRAFT":
            result["busy"].append(code)
        elif comparable(applied(row["content"], entry)) == comparable(row["content"]):
            result["same"].append(code)
        else:
            result["change"].append(code)
    return result


def ledger(entry):
    STATE.mkdir(exist_ok=True)
    with (STATE / "item-gameplay.jsonl").open("a", encoding="utf-8") as file:
        file.write(json.dumps(entry, ensure_ascii=False) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Fork and fill correction drafts.")
    parser.add_argument("--publish", action="store_true", help="Also publish each correction draft.")
    parser.add_argument("--backend", default="http://localhost:8080")
    parser.add_argument("--keycloak", default="http://localhost:8081")
    parser.add_argument("--ruleset", default="aov-standard")
    parser.add_argument("--file", default=str(GAMEPLAY))
    parser.add_argument("--only", help="Comma-separated item codes to limit the run to.")
    args = parser.parse_args()
    if args.publish and not args.apply:
        parser.error("--publish needs --apply.")

    gameplay = load_gameplay(args.file)
    if args.only:
        wanted = set(args.only.split(","))
        gameplay["items"] = {code: entry for code, entry in gameplay["items"].items() if code in wanted}
    api = shared.load_api(args.backend, args.keycloak)
    ruleset = next(row for row in api.call("/admin/rulesets") if row["code"] == args.ruleset)
    listed = shared.all_rows(api, "/admin/items", rulesetId=ruleset["id"])
    work = plan(listed, gameplay)
    print(json.dumps({key: len(value) for key, value in work.items()}, ensure_ascii=False))
    for key in ("busy", "unknown"):
        if work[key]:
            print(f"{key}: {', '.join(work[key])}")
    if not args.apply:
        print("Dry run: " + ", ".join(work["change"]))
        return 0

    by_code = {row["code"]: row for row in listed}
    note = gameplay["changeNote"]
    for code in work["change"]:
        row = by_code[code]
        draft = api.call(f"/admin/items/{row['id']}/drafts", "POST", {
            "rulesetId": ruleset["id"], "sourceRevisionId": row["revision"]["id"], "cause": "CONTENT_CORRECTION",
            "changeNote": note})
        ledger({"code": code, "step": "forked", "id": row["id"], "revisionId": draft["revision"]["id"]})
        content = applied(draft["content"], gameplay["items"][code])
        saved = api.call(f"/admin/items/{row['id']}/drafts/{draft['revision']['id']}", "PUT", {
            "expectedVersion": draft["revision"]["version"], "content": content, "changeNote": note})
        ledger({"code": code, "step": "updated", "revisionId": draft["revision"]["id"],
                "version": saved["revision"]["version"]})
        if args.publish:
            api.call(f"/admin/items/{row['id']}/drafts/{draft['revision']['id']}/publish", "POST", {
                "expectedVersion": saved["revision"]["version"], "changeNote": note})
            ledger({"code": code, "step": "published", "revisionId": draft["revision"]["id"]})
        print(f"{code}: {'published' if args.publish else 'draft saved'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
