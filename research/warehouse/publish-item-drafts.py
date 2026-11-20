"""Publish the open item drafts that change something, on the local stack or a deployed one.

Lists every item, reads each open draft and the published revision it was forked from, and keeps the drafts whose
content differs from that revision. A draft that changes nothing is left as it is. Nothing is published without
--apply; a dry run prints what would be published and which fields each draft changes.

Every publish is appended to .local-state/item-draft-publishes.jsonl. Sign-in is the same as correct-enchantments.py:
the local stack signs in like the other research tools, a deployed stack (an https --backend) as the wiki-importer
service account with the secret in WIKI_IMPORTER_CLIENT_SECRET, which is never printed or stored.
"""

import argparse
import importlib.util
import json
from pathlib import Path
import sys
import time

HERE = Path(__file__).resolve().parent
STATE = HERE / ".local-state"


def load_api(backend, keycloak):
    spec = importlib.util.spec_from_file_location("correct_enchantments", HERE / "correct-enchantments.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.load_api(backend, keycloak)


def listed_items(api):
    rows = []
    for page in range(20):
        result = api.call(f"/admin/items?page={page}&size=100")
        batch = result.get("items") or result.get("content") or []
        rows.extend(batch)
        if len(batch) < 100:
            return rows
    raise RuntimeError("More than 2000 items; the listing did not end.")


def changed_fields(draft, source):
    """The top-level content fields, and for translations each locale's fields, that the draft changes."""
    a, b = draft.get("content") or {}, source.get("content") or {}
    fields = []
    for key in sorted(set(a) | set(b)):
        if key == "translations":
            continue
        if json.dumps(a.get(key), sort_keys=True) != json.dumps(b.get(key), sort_keys=True):
            fields.append(key)
    by_locale = lambda value: {t.get("locale"): t for t in value.get("translations") or []}
    ta, tb = by_locale(a), by_locale(b)
    for locale in sorted(set(ta) | set(tb), key=str):
        x, y = ta.get(locale) or {}, tb.get(locale) or {}
        names = sorted(k for k in set(x) | set(y) if json.dumps(x.get(k), sort_keys=True) != json.dumps(y.get(k), sort_keys=True))
        if names:
            fields.append(f"{locale}:{'/'.join(names)}")
    return fields


def plan(api, rows, causes):
    work = []
    for row in rows:
        revision = row["revision"]
        if revision["state"] != "DRAFT" or (causes and revision["cause"] not in causes):
            continue
        draft = api.call(f"/admin/items/{row['id']}/revisions/{revision['id']}")
        source_id = revision.get("sourceRevisionId")
        source = api.call(f"/admin/items/{row['id']}/revisions/{source_id}") if source_id else {}
        fields = changed_fields(draft, source)
        work.append({"code": row["code"], "id": row["id"], "revision": revision, "fields": fields})
    return work


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend", default="http://localhost:8080")
    parser.add_argument("--keycloak", default="http://localhost:8081")
    parser.add_argument("--cause", action="append", help="Only drafts of this cause; may repeat.")
    parser.add_argument("--apply", action="store_true", help="Publish the drafts that change something.")
    parser.add_argument("--note", default="Publish the reviewed item text and its English translation.")
    args = parser.parse_args()

    api = load_api(args.backend, args.keycloak)
    work = plan(api, listed_items(api), set(args.cause or []))
    changing = [entry for entry in work if entry["fields"]]
    unchanged = [entry["code"] for entry in work if not entry["fields"]]
    print(json.dumps({"drafts": len(work), "change": len(changing), "unchanged": len(unchanged)}))
    if unchanged:
        print("left as they are (no change): " + ", ".join(unchanged))
    if not args.apply:
        for entry in changing:
            print(f"  {entry['code']} [{entry['revision']['cause']}]: {', '.join(entry['fields'])}")
        print("Dry run: nothing published.")
        return 0

    STATE.mkdir(exist_ok=True)
    ledger = STATE / "item-draft-publishes.jsonl"
    for entry in changing:
        revision = entry["revision"]
        api.call(f"/admin/items/{entry['id']}/drafts/{revision['id']}/publish", "POST", {
            "expectedVersion": revision["version"], "changeNote": args.note})
        with ledger.open("a", encoding="utf-8") as out:
            out.write(json.dumps({"at": int(time.time()), "backend": args.backend, "code": entry["code"],
                                  "revisionId": revision["id"], "step": "published"}) + "\n")
        print(f"{entry['code']}: published")
    return 0


if __name__ == "__main__":
    sys.exit(main())
