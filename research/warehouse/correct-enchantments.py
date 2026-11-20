"""Apply reviewed enchantment corrections as CONTENT_CORRECTION drafts through the admin API.

Reads enchantment-corrections.json, compares every entry with the published enchantment of the same code and, for
those that differ, forks a correction draft, writes the corrected text and gameplay into it, and publishes it only with
--publish. Nothing is written without --apply. An enchantment that already has an open draft is left alone.
Every write is appended to .local-state/enchantment-corrections.jsonl, so a run can be followed and undone.
"""

import argparse
import copy
import importlib.util
import json
from pathlib import Path
import sys
from urllib.parse import urlencode


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
STATE = HERE / ".local-state"
CORRECTIONS = HERE / "enchantment-corrections.json"
USE_FIELDS = ("activation", "cooldownSeconds", "cooldownMaxSeconds", "maxUses", "availableFromSeconds",
              "availableUntilSeconds")
TEXT_FIELDS = ("name", "summary", "description")


def load_corrections(path=CORRECTIONS):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 1:
        raise ValueError("Unknown corrections schema.")
    return data


def corrected(content, change, locale):
    """The content with the correction applied: the use fields as given, the locale's text replaced, the rest kept."""
    result = copy.deepcopy(content)
    for field in USE_FIELDS:
        result[field] = change.get(field)
    translations = result.setdefault("translations", [])
    text = next((row for row in translations if row.get("locale") == locale), None)
    if text is None:
        text = {"locale": locale}
        translations.append(text)
    for field in TEXT_FIELDS:
        if field in change:
            text[field] = change[field]
    return result


def comparable(content, locale):
    """What a correction may change, in a form where 10 and 10.0 compare equal."""
    text = next((row for row in content.get("translations", []) if row.get("locale") == locale), {})
    use = {field: (float(content[field]) if isinstance(content.get(field), (int, float)) else content.get(field))
           for field in USE_FIELDS}
    use["activation"] = use["activation"] or "UNKNOWN"
    return {"use": use, "text": {field: text.get(field) for field in TEXT_FIELDS}}


def plan(listed, corrections):
    """Which enchantments change, which already match, which are busy with a draft, which codes are unknown.

    The admin list gives the latest revision of each enchantment: an open draft there means no correction can be forked.
    """
    locale = corrections["locale"]
    by_code = {row["code"]: row for row in listed}
    busy = {row["code"] for row in listed if row["revision"]["state"] == "DRAFT"}
    result = {"change": [], "same": [], "busy": [], "unknown": []}
    for code, change in corrections["enchantments"].items():
        row = by_code.get(code)
        if row is None:
            result["unknown"].append(code)
        elif code in busy:
            result["busy"].append(code)
        elif comparable(corrected(row["content"], change, locale), locale) == comparable(row["content"], locale):
            result["same"].append(code)
        else:
            result["change"].append(code)
    return result


def load_api(backend, keycloak):
    spec = importlib.util.spec_from_file_location("patch_import_helpers", ROOT / "research/patches/2026/import-patches.py")
    helpers = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helpers)
    return helpers.Api(backend, keycloak)


def all_rows(api, path, **query):
    rows, page = [], 0
    while True:
        result = api.call(path + "?" + urlencode({"page": page, "size": 100, **query}))
        rows.extend(result["items"])
        if len(rows) >= result["totalElements"] or not result["items"]:
            return rows
        page += 1


def ledger(entry):
    STATE.mkdir(exist_ok=True)
    with (STATE / "enchantment-corrections.jsonl").open("a", encoding="utf-8") as file:
        file.write(json.dumps(entry, ensure_ascii=False) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Fork and fill correction drafts.")
    parser.add_argument("--publish", action="store_true", help="Also publish each correction draft.")
    parser.add_argument("--backend", default="http://localhost:8080")
    parser.add_argument("--keycloak", default="http://localhost:8081")
    parser.add_argument("--ruleset", default="aov-standard")
    args = parser.parse_args()
    if args.publish and not args.apply:
        parser.error("--publish needs --apply.")

    corrections = load_corrections()
    api = load_api(args.backend, args.keycloak)
    ruleset = next(row for row in api.call("/admin/rulesets") if row["code"] == args.ruleset)
    locale = corrections["locale"]
    listed = all_rows(api, "/admin/enchantments", rulesetId=ruleset["id"], locale=locale)
    work = plan(listed, corrections)
    print(json.dumps({key: len(value) for key, value in work.items()}, ensure_ascii=False))
    for key in ("busy", "unknown"):
        if work[key]:
            print(f"{key}: {', '.join(work[key])}")
    causes = sorted({row["revision"]["cause"] for row in listed if row["code"] in work["busy"]})
    if causes:
        print("Open drafts to publish or discard first: " + ", ".join(causes))
    if not args.apply:
        print("Dry run: " + ", ".join(work["change"]))
        return 0

    by_code = {row["code"]: row for row in listed}
    note = corrections["changeNote"]
    for code in work["change"]:
        row = by_code[code]
        draft = api.call(f"/admin/enchantments/{row['id']}/drafts", "POST", {
            "rulesetId": ruleset["id"], "sourceRevisionId": row["revision"]["id"],
            "cause": "CONTENT_CORRECTION", "changeNote": note})
        ledger({"code": code, "step": "forked", "id": row["id"], "revisionId": draft["revision"]["id"]})
        content = corrected(draft["content"], corrections["enchantments"][code], locale)
        saved = api.call(f"/admin/enchantments/{row['id']}/drafts/{draft['revision']['id']}", "PUT", {
            "expectedVersion": draft["revision"]["version"], "content": content, "changeNote": note})
        ledger({"code": code, "step": "updated", "revisionId": draft["revision"]["id"],
                "version": saved["revision"]["version"]})
        if args.publish:
            api.call(f"/admin/enchantments/{row['id']}/drafts/{draft['revision']['id']}/publish", "POST", {
                "expectedVersion": saved["revision"]["version"], "changeNote": note})
            ledger({"code": code, "step": "published", "revisionId": draft["revision"]["id"]})
        print(f"{code}: {'published' if args.publish else 'draft saved'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
