"""Apply reviewed enchantment or item corrections or translations as drafts through the admin API.

A file names its catalog with "kind" ("enchantments" when absent, or "items") and lists its entries under that key.

Reads enchantment-corrections.json (or the file given with --file), compares every entry with the published enchantment of the same code and, for
those that differ, forks a correction draft, writes the corrected text and gameplay into it, and publishes it only with
--publish. Nothing is written without --apply. An enchantment that already has an open draft is left alone.
Every write is appended to .local-state/enchantment-corrections.jsonl, so a run can be followed and undone.

Against the local stack it signs in like the other research tools. Against a deployed stack (an https --backend) it
signs in as the wiki-importer service account with the secret in WIKI_IMPORTER_CLIENT_SECRET, which the person running
it sets in their own shell; the tool never prints or stores it.
"""

import argparse
import copy
import importlib.util
import json
import os
from pathlib import Path
import sys
import time
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


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
    """The content with the change applied: the locale's text replaced and, for a change that names an activation, the
    use fields as given (a missing one becomes empty); everything else is kept."""
    result = copy.deepcopy(content)
    if "activation" in change:
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


def kind_of(corrections):
    kind = corrections.get("kind", "enchantments")
    if kind not in ("enchantments", "items"):
        raise ValueError("Unknown catalog kind.")
    return kind


def plan(listed, corrections):
    """Which enchantments change, which already match, which are busy with a draft, which codes are unknown.

    The admin list gives the latest revision of each enchantment: an open draft there means no correction can be forked.
    """
    locale = corrections["locale"]
    by_code = {row["code"]: row for row in listed}
    busy = {row["code"] for row in listed if row["revision"]["state"] == "DRAFT"}
    result = {"change": [], "same": [], "busy": [], "unknown": []}
    for code, change in corrections[kind_of(corrections)].items():
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


class RemoteApi:
    """The admin API of a deployed stack, as the wiki-importer service account."""

    def __init__(self, backend, keycloak, client_id, secret):
        for url in (backend, keycloak):
            if urlparse(url).scheme != "https":
                raise ValueError("A deployed stack is reached over https only.")
        backend = backend.rstrip("/")
        self.base = backend if backend.endswith("/api/wiki/v1") else backend + "/api/wiki/v1"
        self.keycloak = keycloak.rstrip("/")
        self.client_id, self.secret = client_id, secret
        self.token, self.expires = None, 0

    def authenticate(self):
        body = urlencode({"grant_type": "client_credentials", "client_id": self.client_id,
                          "client_secret": self.secret}).encode()
        request = Request(self.keycloak + "/realms/wikiaov/protocol/openid-connect/token", data=body)
        try:
            with urlopen(request, timeout=30) as response:
                result = json.load(response)
        except HTTPError as error:
            raise RuntimeError(f"Sign-in refused: {error.code}. Check WIKI_IMPORTER_CLIENT_SECRET.") from None
        self.token = result["access_token"]
        self.expires = time.monotonic() + result["expires_in"] - 30

    def call(self, path, method="GET", body=None):
        if not self.token or time.monotonic() >= self.expires:
            self.authenticate()
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode()
        request = Request(self.base + path, method=method, data=data, headers={
            "Authorization": "Bearer " + self.token, "Content-Type": "application/json", "Accept": "application/json"})
        try:
            with urlopen(request, timeout=45) as response:
                text = response.read().decode()
                return json.loads(text) if text else None
        except HTTPError as error:
            raise RuntimeError(f"{method} {path}: {error.code} {error.read().decode()}") from None


def load_api(backend, keycloak):
    if urlparse(backend).scheme == "https":
        secret = os.getenv("WIKI_IMPORTER_CLIENT_SECRET")
        if not secret:
            raise SystemExit("Set WIKI_IMPORTER_CLIENT_SECRET in your shell to sign in to a deployed stack.")
        return RemoteApi(backend, keycloak, os.getenv("WIKI_IMPORTER_CLIENT_ID", "wiki-importer"), secret)
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
    parser.add_argument("--file", default=str(CORRECTIONS), help="A corrections or translations file.")
    parser.add_argument("--discard-translation-drafts", action="store_true",
                        help="With --apply: save, then discard the open TRANSLATION_UPDATE drafts in the way.")
    args = parser.parse_args()
    if args.publish and not args.apply:
        parser.error("--publish needs --apply.")

    corrections = load_corrections(args.file)
    api = load_api(args.backend, args.keycloak)
    ruleset = next(row for row in api.call("/admin/rulesets") if row["code"] == args.ruleset)
    locale = corrections["locale"]
    kind = kind_of(corrections)
    listed = all_rows(api, f"/admin/{kind}", rulesetId=ruleset["id"], locale=locale)
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

    if args.discard_translation_drafts:
        # The open translation drafts are kept in a file first, so their text is not lost with them.
        busy = [row for row in listed if row["code"] in work["busy"] and row["revision"]["cause"] == "TRANSLATION_UPDATE"]
        saved = {row["code"]: api.call(f"/admin/{kind}/{row['id']}/revisions/{row['revision']['id']}")
                 for row in busy}
        STATE.mkdir(exist_ok=True)
        backup = STATE / f"translation-drafts-{int(time.time())}.json"
        backup.write_text(json.dumps(saved, ensure_ascii=False, indent=2), encoding="utf-8")
        for row in busy:
            api.call(f"/admin/{kind}/{row['id']}/drafts/{row['revision']['id']}/discard", "POST", {
                "expectedVersion": row["revision"]["version"], "changeNote": corrections["changeNote"]})
            ledger({"code": row["code"], "step": "discarded-translation", "revisionId": row["revision"]["id"]})
        print(f"Discarded {len(busy)} translation drafts; their text is in {backup}.")
        return 0

    by_code = {row["code"]: row for row in listed}
    note = corrections["changeNote"]
    for code in work["change"]:
        row = by_code[code]
        draft = api.call(f"/admin/{kind}/{row['id']}/drafts", "POST", {
            "rulesetId": ruleset["id"], "sourceRevisionId": row["revision"]["id"],
            "cause": corrections.get("cause", "CONTENT_CORRECTION"), "changeNote": note})
        ledger({"code": code, "step": "forked", "id": row["id"], "revisionId": draft["revision"]["id"]})
        content = corrected(draft["content"], corrections[kind][code], locale)
        saved = api.call(f"/admin/{kind}/{row['id']}/drafts/{draft['revision']['id']}", "PUT", {
            "expectedVersion": draft["revision"]["version"], "content": content, "changeNote": note})
        ledger({"code": code, "step": "updated", "revisionId": draft["revision"]["id"],
                "version": saved["revision"]["version"]})
        if args.publish:
            api.call(f"/admin/{kind}/{row['id']}/drafts/{draft['revision']['id']}/publish", "POST", {
                "expectedVersion": saved["revision"]["version"], "changeNote": note})
            ledger({"code": code, "step": "published", "revisionId": draft["revision"]["id"]})
        print(f"{code}: {'published' if args.publish else 'draft saved'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
