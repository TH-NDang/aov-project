"""Import every resource image through Media and retain all candidates in hero drafts."""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import copy
import hashlib
import http.client
import importlib.util
import json
import mimetypes
from pathlib import Path
import re
import sys
import socket
import threading
import time
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse
from urllib.request import HTTPHandler, HTTPRedirectHandler, Request, build_opener


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RESOURCES = ROOT / "resources" / "Lien-Quan-v3"
STATE = HERE / ".local-state"
NOTE = "Import character image candidates from resources"
ROLES = {"HEAD": "head", "PORTRAIT": "portrait", "SPLASH": "cover"}
SKIN_KEYS = {"HEAD": "headAssetId", "PORTRAIT": "portraitAssetId", "SPLASH": "artAssetId"}
helper_spec = importlib.util.spec_from_file_location("patch_import_helpers", ROOT / "research/patches/2026/import-patches.py")
helpers = importlib.util.module_from_spec(helper_spec)
helper_spec.loader.exec_module(helpers)


class LoopbackConnection(http.client.HTTPConnection):
    """Keep the signed Host header while avoiding IPv6 retries on local Docker ports."""

    def connect(self):
        if self.host.lower() == "localhost":
            self.sock = socket.create_connection(("127.0.0.1", self.port), self.timeout, self.source_address)
        else:
            super().connect()


class LoopbackHandler(HTTPHandler):
    def http_open(self, request):
        return self.do_open(LoopbackConnection, request)


urlopen = build_opener(LoopbackHandler()).open
helpers.urlopen = urlopen


class NoUploadRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise ValueError("Object storage upload redirects are not allowed.")


upload_urlopen = build_opener(LoopbackHandler(), NoUploadRedirect()).open


def upload_host(value):
    host = value.lower()
    if (len(host) > 253 or not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?", host)
            or "." not in host or any(not part or len(part) > 63 or part.startswith("-") or part.endswith("-")
                                      for part in host.split("."))):
        raise argparse.ArgumentTypeError("Upload host must be an exact DNS hostname without scheme, port, path or wildcard.")
    return host


def add_upload_host_argument(parser):
    parser.add_argument("--upload-host", action="append", type=upload_host, default=[], metavar="HOST",
                        help="Allow HTTPS upload tickets only on this exact hostname; repeat for additional hosts.")


def validate_upload_url(value, allowed_hosts=()):
    if not isinstance(value, str) or any(character.isspace() for character in value) or "\\" in value or "#" in value:
        raise ValueError("Object storage upload URL contains unsafe characters.")
    try:
        storage = urlparse(value)
        host, port = storage.hostname, storage.port
        if host is None or storage.username is not None or storage.password is not None:
            raise ValueError()
        if storage.scheme == "http" and host in {"localhost", "127.0.0.1", "::1"}:
            if port is not None and not 1 <= port <= 65535:
                raise ValueError()
            return value
        approved = {upload_host(item) for item in allowed_hosts}
        if storage.scheme == "https" and host in approved and port is None and storage.netloc.lower() == host:
            return value
    except (ValueError, argparse.ArgumentTypeError):
        pass
    raise ValueError("Upload target must be loopback storage or an explicitly allowed HTTPS hostname without a port.")


def upload_ticket(ticket, data, allowed_hosts=()):
    url = validate_upload_url(ticket["uploadUrl"], allowed_hosts)
    if ticket["method"] != "PUT":
        raise ValueError("Media upload tickets must use PUT.")
    request = Request(url, method="PUT", headers=ticket["headers"], data=data)
    with upload_urlopen(request, timeout=120) as response:
        if response.status not in {200, 201, 204}:
            raise RuntimeError("Object storage rejected the upload.")


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for attempt in range(8):
        try:
            temporary.replace(path)
            return
        except PermissionError:
            if attempt == 7:
                raise
            time.sleep(min(0.01 * 2 ** attempt, 0.25))


def local_file(value):
    if not isinstance(value, str) or not value.startswith("assets/"):
        raise ValueError("An image must have a package-relative assets path.")
    path = (RESOURCES / value).resolve()
    if not path.is_relative_to(RESOURCES.resolve()) or not path.is_file():
        raise ValueError(f"Resource image is missing or outside the package: {value}")
    return path


def paths(owner, role, hero=False):
    values = [owner.get(ROLES[role])]
    if role == "PORTRAIT":
        values.extend(owner.get("portraitAlternates", []))
    if hero and role == "HEAD":
        values.append(owner.get("listHead"))
    return list(dict.fromkeys(value for value in values if value))


def image_label(source_path):
    path = Path(source_path)
    parts = path.parts
    if "variants" in parts:
        index = parts.index("variants")
        if index + 1 < len(parts) and parts[index + 1].isdigit():
            return f"{path.stem}-{int(parts[index + 1])}{path.suffix}"
    return path.name


def supported(source_path):
    return mimetypes.guess_type(source_path)[0] in {"image/png", "image/jpeg", "image/webp"}


def skin_name(source):
    return (source.get("name") or "").strip() or (source.get("fullName") or "").strip() or source["id"]


def all_pages(api, path, **query):
    output = []
    page = 0
    while True:
        result = api.call(path + "?" + urlencode({"page": page, "size": 100, **query}))
        if isinstance(result, list):
            return result
        output.extend(result["items"])
        if len(output) >= result["totalElements"] or not result["items"]:
            return output
        page += 1


class Importer:
    def __init__(self, args):
        self.args = args
        self.api = helpers.Api(args.backend, args.keycloak)
        self.resources = read(RESOURCES / "data/heroes.json")
        self.checkpoint_file = STATE / "checkpoint.json"
        self.state = read(self.checkpoint_file) if self.checkpoint_file.exists() else {"schemaVersion": 1, "assets": {}, "heroes": {}}
        if self.state.get("backend", args.backend.rstrip("/")) != args.backend.rstrip("/"):
            raise ValueError("The checkpoint belongs to a different backend.")
        self.state["backend"] = args.backend.rstrip("/")
        self.state_lock = threading.RLock()
        rename_plan = HERE / "canonical-identifiers.json"
        self.path_aliases = {}
        self.skin_aliases, self.badge_aliases, self.hero_aliases = {}, {}, {}
        if rename_plan.exists():
            identifiers = read(rename_plan)
            self.skin_aliases = {row["old"]: row["code"] for row in identifiers["skins"]}
            self.badge_aliases = {row["old"]: row["code"] for row in identifiers["badges"]}
            self.hero_aliases = identifiers["heroes"]
            renames = identifiers["files"]
            renamed_paths = {row["old"]: row["path"] for row in renames}
            for row in renames:
                self.path_aliases.setdefault(row["path"], []).append(row["old"])
            for semantic_path, entry in list(self.state["assets"].items()):
                semantic, old_path = semantic_path.split(":", 1)
                match = renamed_paths.get(old_path)
                if match:
                    self.state["assets"].setdefault(semantic + ":" + match, entry)
        self.asset_locks = {}
        self.assets = {}
        self.uploaded = 0
        self.reused = 0
        self.failures = []
        self.ruleset = next(item for item in self.api.call("/admin/rulesets") if item["code"] == args.ruleset)
        overview = self.api.call("/admin/publication-overview")
        self.ordinals = {item["id"]: item["rulesetOrdinal"] for item in overview["variants"]}

    def checkpoint(self):
        with self.state_lock:
            write(self.checkpoint_file, self.state)

    def asset(self, asset_id):
        if asset_id not in self.assets:
            self.assets[asset_id] = self.api.call("/admin/media/assets/" + asset_id)
        return self.assets[asset_id]

    def matching_asset(self, source_path, semantic, known):
        for asset_id in dict.fromkeys(known):
            if not asset_id:
                continue
            asset = self.asset(asset_id)
            if asset["semanticType"] != semantic or not asset.get("currentVersionId") or asset["state"] != "ACTIVE":
                continue
            for provenance in asset.get("provenance", []):
                note = (provenance.get("note") or "").replace("\\", "/")
                candidates = [source_path, *getattr(self, "path_aliases", {}).get(source_path, [])]
                if note.removeprefix("/__resources/") in candidates:
                    return asset_id
        return None

    def upload(self, source_path, semantic, known=()):
        key = semantic + ":" + source_path
        with self.state_lock:
            lock = self.asset_locks.setdefault(key, threading.Lock())
        with lock:
            return self.upload_one(source_path, semantic, known)

    def upload_one(self, source_path, semantic, known=()):
        file = local_file(source_path)
        data = file.read_bytes()
        if data.startswith(b"version https://git-lfs.github.com/spec/"):
            raise ValueError(f"Git LFS bytes are unavailable: {source_path}")
        content_type = mimetypes.guess_type(file.name)[0]
        if content_type not in {"image/png", "image/jpeg", "image/webp"} or not data or len(data) > 25 * 1024 * 1024:
            raise ValueError(f"Unsupported image type or size: {source_path}")
        sha = hashlib.sha256(data).hexdigest()
        key = semantic + ":" + source_path
        entry = self.state["assets"].get(key)
        if entry and entry.get("sha256") != sha:
            raise ValueError(f"Resource bytes changed after checkpoint: {source_path}")
        if entry and entry.get("complete"):
            with self.state_lock:
                self.reused += 1
            return entry["assetId"]
        existing = self.matching_asset(source_path, semantic, known)
        if existing:
            with self.state_lock:
                self.state["assets"][key] = {"assetId": existing, "sha256": sha, "complete": True, "reused": True}
                self.checkpoint()
                self.reused += 1
            return existing
        if not entry:
            created = self.api.call("/admin/media/assets", "POST", {"semanticType": semantic, "source": {
                "label": "Ảnh từ tài nguyên Liên Quân", "url": None, "note": source_path,
            }})
            entry = {"assetId": created["id"], "sha256": sha, "complete": False}
            with self.state_lock:
                self.state["assets"][key] = entry
                self.checkpoint()
        if entry.get("uploadId"):
            try:
                result = self.api.call("/admin/media/uploads/" + entry["uploadId"] + "/complete", "POST")
                if result["current"]:
                    with self.state_lock:
                        entry["complete"] = True
                        self.checkpoint()
                        self.reused += 1
                    return entry["assetId"]
            except RuntimeError:
                pass
        ticket = self.api.call("/admin/media/assets/" + entry["assetId"] + "/version-uploads", "POST", {
            "fileName": file.name, "contentType": content_type, "sizeBytes": len(data),
        })
        with self.state_lock:
            entry["uploadId"] = ticket["uploadId"]
            self.checkpoint()
        try:
            upload_ticket(ticket, data, getattr(self.args, "upload_host", ()))
        except HTTPError as error:
            raise RuntimeError(f"Object storage upload failed with HTTP {error.code}: {source_path}") from None
        result = self.api.call("/admin/media/uploads/" + ticket["uploadId"] + "/complete", "POST")
        if not result["current"]:
            raise RuntimeError("The newly imported image is not the active asset version.")
        with self.state_lock:
            entry["complete"] = True
            self.checkpoint()
            self.uploaded += 1
            if self.uploaded % 25 == 0:
                print(f"Images uploaded: {self.uploaded}; reused: {self.reused}", flush=True)
        return entry["assetId"]

    def selected(self, hero):
        revisions = [item for item in hero["revisions"] if item["rulesetId"] == self.ruleset["id"] and item["state"] != "DISCARDED"]
        return max(revisions, key=lambda item: (self.ordinals.get(item.get("effectiveFromPatchVariantId"), 0), item["revisionNo"])) if revisions else None

    def fill_images(self, target, source, hero=False):
        for role in ROLES:
            source_paths = paths(source, role, hero)
            if not source_paths:
                continue
            images = target.setdefault("images", {}).setdefault(role, [])
            current = target.setdefault("bindings", {}).get(role) if hero else target.get(SKIN_KEYS[role])
            known = [current, *[item["assetId"] for item in images]]
            if current and not any(item["assetId"] == current for item in images):
                images.append({"assetId": current, "label": None})
            semantic = "HERO_" + role if hero else "HERO_SKIN_ART"
            for source_path in source_paths:
                if not supported(source_path):
                    continue
                asset_id = self.upload(source_path, semantic, known)
                found = next((item for item in images if item["assetId"] == asset_id), None)
                if found:
                    if not found.get("label") or found["label"] == Path(source_path).name:
                        found["label"] = image_label(source_path)
                else:
                    images.append({"assetId": asset_id, "label": image_label(source_path)})
                if not current and source_path == source.get(ROLES[role]):
                    if hero:
                        target["bindings"][role] = asset_id
                    else:
                        target[SKIN_KEYS[role]] = asset_id
                    current = asset_id

    def save(self, hero_id, revision, section, content):
        return self.api.call(f"/admin/heroes/{hero_id}/drafts/{revision['id']}/{section}", "PUT", {
            **content, "expectedDraftVersion": revision["version"], "changeNote": NOTE,
        })

    def import_hero(self, hero, source):
        revision = self.selected(hero)
        if not revision:
            raise ValueError("No revision is available in the selected ruleset.")
        if revision["state"] != "DRAFT" and any(item["rulesetId"] == self.ruleset["id"] and item["state"] == "DRAFT" for item in hero["revisions"]):
            raise ValueError("Another draft exists in a different gameplay context; no images were uploaded.")
        preview = self.api.preview(hero["id"], revision["id"])
        original = preview["content"]
        backup = STATE / "backups" / (hero["code"] + "-" + revision["id"] + ".json")
        if not backup.exists():
            write(backup, {"revision": revision, "content": original})
        content = copy.deepcopy(original)
        media = content.get("mediaBindings") or {"bindings": {}, "sources": []}
        skins = content.get("skins") or {"skins": [], "sources": []}
        self.fill_images(media, source, True)
        existing = {skin["skinKey"]: skin for skin in skins["skins"]}
        for raw in source["skins"]:
            skin = existing.get(raw["id"])
            if not skin:
                skin = {"skinKey": raw["id"], "displayOrder": max((item["displayOrder"] for item in skins["skins"]), default=-1) + 1,
                        "artAssetId": None, "headAssetId": None, "portraitAssetId": None,
                        "rarityCode": raw.get("badgeId"), "translations": [{"locale": "vi-VN", "name": skin_name(raw),
                        "description": None, "acquisitionNote": None}]}
                skins["skins"].append(skin)
                if not (raw.get("name") or "").strip():
                    note = f"{raw['id']}: source name is missing; fullName or stable code is used for draft display and requires review."
                    if not any(item.get("note") == note for item in skins["sources"]):
                        skins["sources"].append({"label": "Tài nguyên trang phục cần kiểm tra", "sourceUrl": None,
                            "observedAt": None, "verificationState": "UNVERIFIED", "note": note})
            self.fill_images(skin, raw)
        changed = []
        if media != original.get("mediaBindings"):
            changed.append(("media-bindings", media))
        if skins != original.get("skins"):
            changed.append(("skins", skins))
        if not changed:
            return {"code": hero["code"], "status": "unchanged", "revisionId": revision["id"]}
        if revision["state"] != "DRAFT":
            revision = self.api.call(f"/admin/heroes/{hero['id']}/drafts", "POST", {
                "rulesetId": self.ruleset["id"], "sourceRevisionId": revision["id"], "cause": "VISUAL_UPDATE",
                "effectiveFromPatchVariantId": revision.get("effectiveFromPatchVariantId"),
            })
        for section, value in changed:
            revision = self.save(hero["id"], revision, section, value)
        result = {"code": hero["code"], "status": "saved-draft", "revisionId": revision["id"],
                  "version": revision["version"], "sections": [key for key, _ in changed]}
        with self.state_lock:
            self.state["heroes"][hero["code"]] = result
            self.checkpoint()
        return result

    def badges(self):
        known = {item["code"]: item for item in all_pages(self.api, "/admin/skin-badges", rulesetId=self.ruleset["id"], locale="vi-VN")}
        updated = 0
        for source in self.resources["badges"]:
            badge = known.get(source["id"])
            translations = copy.deepcopy(badge.get("translations", []) if badge else [])
            translation = next((item for item in translations if item["locale"] == "vi-VN"), None)
            if translation and translation.get("iconAssetId"):
                continue
            asset_id = self.upload(source["icon"], "SKIN_BADGE")
            if translation:
                translation["iconAssetId"] = asset_id
            else:
                translations.append({"locale": "vi-VN", "displayName": source.get("name") or source["id"], "iconAssetId": asset_id})
            body = {"kind": badge["kind"] if badge else "UNKNOWN", "translations": translations}
            if badge:
                body["expectedVersion"] = badge["version"]
                self.api.call("/admin/skin-badges/" + badge["id"], "PUT", body)
            else:
                body["code"] = source["id"]
                self.api.call("/admin/skin-badges", "POST", body)
            updated += 1
        return updated

    def verify_badges(self):
        known = {item["code"]: item for item in all_pages(self.api, "/admin/skin-badges", rulesetId=self.ruleset["id"], locale="vi-VN")}
        failures = []
        for source in self.resources["badges"]:
            badge = known.get(source["id"])
            translation = next((item for item in (badge or {}).get("translations", []) if item["locale"] == "vi-VN"), None)
            if not translation or not translation.get("iconAssetId"):
                failures.append("missing Vietnamese badge icon " + source["id"])
                continue
            asset = self.asset(translation["iconAssetId"])
            if asset["semanticType"] != "SKIN_BADGE" or not asset.get("currentVersionId") or asset["state"] != "ACTIVE":
                failures.append("unusable badge icon " + source["id"])
        return failures

    def verify_hero(self, hero, source):
        revision = self.selected(hero)
        if not revision:
            return ["missing revision"]
        content = self.api.preview(hero["id"], revision["id"])["content"]
        failures = []
        backups = list((STATE / "backups").glob(hero["code"] + "-*.json"))
        for old, new in getattr(self, "hero_aliases", {}).items():
            if new == hero["code"]:
                backups.extend((STATE / "backups").glob(old + "-*.json"))
        if backups:
            original = read(min(backups, key=lambda path: path.stat().st_mtime))["content"]
            for key in ("profile", "overviewRatings", "combatStats", "skills"):
                if content.get(key) != original.get(key):
                    failures.append("unrelated content changed " + key)
            for role, asset_id in (original.get("mediaBindings") or {}).get("bindings", {}).items():
                if asset_id and (content.get("mediaBindings") or {}).get("bindings", {}).get(role) != asset_id:
                    failures.append("original hero main changed " + role)
            current_skins = {item["skinKey"]: item for item in (content.get("skins") or {}).get("skins", [])}
            for old in (original.get("skins") or {}).get("skins", []):
                current = current_skins.get(getattr(self, "skin_aliases", {}).get(old["skinKey"], old["skinKey"]), {})
                for key in ("displayOrder", "rarityCode", "translations"):
                    expected = getattr(self, "badge_aliases", {}).get(old.get(key), old.get(key)) if key == "rarityCode" else old.get(key)
                    if current.get(key) != expected:
                        failures.append("original skin metadata changed " + old["skinKey"] + ":" + key)
                for key in SKIN_KEYS.values():
                    if old.get(key) and current.get(key) != old[key]:
                        failures.append("original skin main changed " + old["skinKey"] + ":" + key)
        owners = [(source, content.get("mediaBindings") or {}, True)]
        by_key = {item["skinKey"]: item for item in (content.get("skins") or {}).get("skins", [])}
        for raw in source["skins"]:
            if raw["id"] not in by_key:
                failures.append("missing skin " + raw["id"])
            else:
                owners.append((raw, by_key[raw["id"]], False))
        for raw, target, is_hero in owners:
            for role in ROLES:
                options = target.get("images", {}).get(role, [])
                current = target.get("bindings", {}).get(role) if is_hero else target.get(SKIN_KEYS[role])
                available = {item["assetId"] for item in options} | {current}
                semantic = "HERO_" + role if is_hero else "HERO_SKIN_ART"
                for source_path in paths(raw, role, is_hero):
                    if not supported(source_path):
                        continue
                    saved = self.state["assets"].get(semantic + ":" + source_path)
                    if not saved or saved["assetId"] not in available:
                        failures.append("missing image " + source_path)
                    elif not any(item["assetId"] == saved["assetId"] and item.get("label") == image_label(source_path) for item in options):
                        failures.append("missing filename label " + source_path)
        return failures

    def run(self):
        sources = {item["id"]: item for item in self.resources["heroes"]}
        catalog = self.api.catalog(rulesetId=self.ruleset["id"])
        selected = [item for item in catalog if not self.args.hero or item["code"] in self.args.hero]
        if self.args.limit:
            selected = selected[:self.args.limit]
        missing = [item["code"] for item in selected if item["code"] not in sources]
        source_paths = {path for hero in selected if hero["code"] in sources for owner, is_hero in [(sources[hero["code"]], True), *[(skin, False) for skin in sources[hero["code"]]["skins"]]] for role in ROLES for path in paths(owner, role, is_hero)}
        for path in source_paths:
            local_file(path)
        skipped = [{"path": path, "reason": "Unsupported media format; original file was not converted."} for path in sorted(source_paths) if not supported(path)]
        warnings = [{"code": hero["code"], "skinKey": skin["id"], "warning": "Missing short name; source fullName or stable code is used for draft display."}
                    for hero in selected if hero["code"] in sources for skin in sources[hero["code"]]["skins"] if not (skin.get("name") or "").strip()]
        print(json.dumps({"mode": "apply" if self.args.apply else "verify" if self.args.verify else "preview",
                          "heroes": len(selected), "imageFiles": len(source_paths), "badges": len(self.resources["badges"]),
                          "unmatchedHeroes": missing, "skippedImages": skipped}, ensure_ascii=False), flush=True)
        if not self.args.apply and not self.args.verify:
            return
        results = []
        def process(hero):
            if hero["code"] not in sources:
                return {"code": hero["code"], "error": "No exact resource identity"}
            try:
                return self.import_hero(hero, sources[hero["code"]]) if self.args.apply else {
                    "code": hero["code"], "failures": self.verify_hero(hero, sources[hero["code"]]),
                }
            except (RuntimeError, ValueError, HTTPError, OSError) as error:
                return {"code": hero["code"], "error": str(error)[:1200]}

        with ThreadPoolExecutor(max_workers=self.args.workers) as executor:
            futures = [executor.submit(process, hero) for hero in selected]
            for index, future in enumerate(as_completed(futures)):
                result = future.result()
                results.append(result)
                failed = bool(result.get("failures") or result.get("error"))
                if failed:
                    self.failures.append(result)
                print(f"[{index+1}/{len(selected)}] {result['code']}: {'failed (recorded in local report)' if failed else result.get('status', 'verified')}", flush=True)
        badge_count = None
        if not self.args.hero and not self.args.limit:
            if self.args.apply:
                try:
                    badge_count = self.badges()
                except (RuntimeError, ValueError, HTTPError) as error:
                    self.failures.append({"badges": str(error)[:1200]})
            else:
                badge_failures = self.verify_badges()
                if badge_failures:
                    self.failures.append({"badges": badge_failures})
        report = {"results": results, "failures": self.failures, "uploaded": self.uploaded, "reused": self.reused,
                  "badgesUpdated": badge_count, "skippedImages": skipped, "warnings": warnings}
        write(STATE / ("receipt.json" if self.args.apply else "verification.json"), report)
        print(json.dumps({key: value for key, value in report.items() if key not in {"results", "failures"}} | {"failures": len(self.failures)}, ensure_ascii=False), flush=True)
        if self.failures:
            raise SystemExit(1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--verify", action="store_true")
    parser.add_argument("--backend", default="http://localhost:8080")
    parser.add_argument("--keycloak", default="http://localhost:8081")
    parser.add_argument("--ruleset", default="aov-standard")
    parser.add_argument("--workers", type=int, choices=range(1, 9), default=3)
    parser.add_argument("--hero", action="append")
    parser.add_argument("--limit", type=int)
    add_upload_host_argument(parser)
    args = parser.parse_args()
    try:
        Importer(args).run()
    except (RuntimeError, ValueError, HTTPError, StopIteration) as error:
        print(f"Import stopped: {type(error).__name__}: {str(error)[:1200]}", file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
