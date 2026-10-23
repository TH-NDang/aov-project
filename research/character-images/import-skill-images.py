"""Import source skill icons into a hero-owned visual library without changing gameplay history."""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import importlib.util
import json
import mimetypes
from pathlib import Path
import sys
import threading

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("skill_media_helpers", HERE / "import-images.py")
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)
ROOT, RESOURCES = helpers.ROOT, helpers.RESOURCES
STATE = HERE / ".local-state" / "skill-images.json"


def sources(resources=RESOURCES):
    manifest = helpers.read(resources / "data/nguon-icon-chieu.json")
    seen, output = set(), []
    for row in manifest:
        if row.get("status") != "ok":
            continue
        key = (row["heroId"], row["slot"], row["variant"])
        if key in seen:
            raise ValueError("Duplicate hero/slot/variant in the source manifest.")
        seen.add(key)
        relative = row["file"]
        path = (resources / relative).resolve()
        if not relative.startswith("assets/skill/") or not path.is_relative_to(resources.resolve()) or not path.is_file():
            raise ValueError("Missing or unsafe source skill icon: " + relative)
        data = path.read_bytes()
        if data.startswith(b"version https://git-lfs.github.com/spec/"):
            raise ValueError("Git LFS image bytes are unavailable: " + relative)
        digest = hashlib.sha256(data).hexdigest()
        if digest != row["sha256"]:
            raise ValueError("Source bytes do not match the collected manifest: " + relative)
        output.append({**row, "path": path, "sha256": digest})
    return output


def source_identity(row, heroes, aliases):
    code = aliases.get(row["heroId"], row["heroId"])
    return heroes.get(code)


class Importer:
    def __init__(self, args):
        self.args = args
        self.api = helpers.helpers.Api(args.backend, args.keycloak)
        self.rows = sources()
        self.state = helpers.read(STATE) if STATE.exists() else {"schemaVersion": 1, "assets": {}}
        if self.state.get("backend", args.backend) != args.backend:
            raise ValueError("The checkpoint belongs to another backend.")
        self.state["backend"] = args.backend
        self.lock = threading.RLock()
        self.hash_locks = {}
        self.hash_assets = {}
        self.asset_hashes = {}
        self.uploaded = self.reused = self.saved = self.unchanged = 0
        self.heroes = {hero["code"]: hero for hero in helpers.all_pages(self.api, "/admin/heroes")}
        aliases = helpers.read(HERE / "canonical-identifiers.json").get("heroes", {})
        self.owners = {row["heroId"]: source_identity(row, self.heroes, aliases) for row in self.rows}
        missing = sorted(code for code, owner in self.owners.items() if owner is None)
        if missing:
            raise ValueError("Existing hero identities are missing: " + ", ".join(missing))
        self.inventory = {}
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(self.api.call, "/admin/heroes/" + owner["id"] + "/skill-images"): code
                       for code, owner in self.owners.items()}
            for future in as_completed(futures):
                code = futures[future]
                self.inventory[code] = {(entry["sourceSlot"], entry["variantNo"]): entry for entry in future.result()["items"]}
        summaries = helpers.all_pages(self.api, "/admin/media/assets", semanticType="HERO_SKILL_ICON")
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(self.api.call, "/admin/media/assets/" + row["id"]) for row in summaries
                       if row["state"] == "ACTIVE" and row.get("currentVersionId")]
            for future in as_completed(futures):
                asset = future.result()
                current = next((version for version in asset["versions"] if version["current"] and version["state"] == "READY"), None)
                if current:
                    self.hash_assets.setdefault(current["sha256"], asset["id"])
                    self.asset_hashes[asset["id"]] = current["sha256"]
        self.existing_assets = len(summaries)

    def checkpoint(self):
        with self.lock:
            helpers.write(STATE, self.state)

    def upload(self, row):
        digest = row["sha256"]
        with self.lock:
            lock = self.hash_locks.setdefault(digest, threading.Lock())
        with lock:
            if digest in self.hash_assets:
                with self.lock:
                    self.reused += 1
                return self.hash_assets[digest]
            data = row["path"].read_bytes()
            content_type = mimetypes.guess_type(row["path"].name)[0]
            if content_type not in {"image/png", "image/jpeg", "image/webp"}:
                raise ValueError("Unsupported image type: " + row["file"])
            entry = self.state["assets"].get(row["file"])
            if entry and entry["sha256"] != digest:
                raise ValueError("Source bytes changed after checkpoint: " + row["file"])
            if not entry:
                asset = self.api.call("/admin/media/assets", "POST", {"semanticType": "HERO_SKILL_ICON", "source": {
                    "type": "OTHER", "label": "Icon kỹ năng từ tài nguyên Liên Quân", "url": row.get("url"),
                    "note": json.dumps({"importer": "hero-skill-library-v1", "heroCode": row["heroId"],
                                        "sourceSlot": row["slot"], "variantNo": row["variant"], "file": row["file"],
                                        "sourcePage": row.get("page"), "collectedOn": row.get("collectedOn")},
                                       ensure_ascii=False, separators=(",", ":"))}})
                entry = {"assetId": asset["id"], "sha256": digest, "complete": False}
                with self.lock:
                    self.state["assets"][row["file"]] = entry
                    self.checkpoint()
            if entry.get("uploadId"):
                try:
                    complete = self.api.call("/admin/media/uploads/" + entry["uploadId"] + "/complete", "POST")
                    if complete["current"]:
                        with self.lock:
                            entry["complete"] = True
                            self.hash_assets[digest] = entry["assetId"]
                            self.checkpoint()
                            self.reused += 1
                        return entry["assetId"]
                except RuntimeError:
                    pass
            ticket = self.api.call("/admin/media/assets/" + entry["assetId"] + "/version-uploads", "POST", {
                "fileName": row["path"].name, "contentType": content_type, "sizeBytes": len(data)})
            with self.lock:
                entry["uploadId"] = ticket["uploadId"]
                self.checkpoint()
            helpers.upload_ticket(ticket, data, getattr(self.args, "upload_host", ()))
            complete = self.api.call("/admin/media/uploads/" + ticket["uploadId"] + "/complete", "POST")
            if not complete["current"]:
                raise RuntimeError("The skill icon upload did not create the current asset version.")
            with self.lock:
                entry["complete"] = True
                self.hash_assets[digest] = entry["assetId"]
                self.checkpoint()
                self.uploaded += 1
            return entry["assetId"]

    def import_one(self, row):
        existing = self.inventory[row["heroId"]].get((row["slot"], row["variant"]))
        if existing and self.asset_hashes.get(existing["assetId"]) != row["sha256"]:
            raise ValueError("A library position already has different artwork; review it before replacing: " + row["file"])
        if existing:
            asset_id = existing["assetId"]
            with self.lock:
                self.reused += 1
        else:
            asset_id = self.upload(row)
        body = {"expectedVersion": existing["version"] if existing else -1, "assetId": asset_id,
                "skillKey": existing.get("skillKey") if existing else None,
                "sourceFilename": row["path"].name, "label": existing.get("label") if existing else row["path"].name}
        owner = self.owners[row["heroId"]]
        result = self.api.call(f"/admin/heroes/{owner['id']}/skill-images/{row['slot']}/{row['variant']}", "PUT", body)
        with self.lock:
            if existing and result["version"] == existing["version"]:
                self.unchanged += 1
            else:
                self.saved += 1
            self.state.setdefault("bindings", {})[row["file"]] = {"id": result["id"], "heroId": owner["id"], "assetId": asset_id}
            self.checkpoint()
            if (self.saved + self.unchanged) % 25 == 0:
                print(f"Icons processed: {self.saved + self.unchanged}/{len(self.rows)}; uploaded: {self.uploaded}; reused: {self.reused}", flush=True)

    def run(self):
        report = {"sourceFiles": len(self.rows), "heroes": len(self.owners), "uniqueHashes": len({row["sha256"] for row in self.rows}),
                  "existingSkillAssets": self.existing_assets, "existingLibraryRows": sum(len(rows) for rows in self.inventory.values()),
                  "gameplayRevisionsModified": 0}
        if not self.args.apply:
            print(json.dumps(report, ensure_ascii=False), flush=True)
            return
        failures = []
        with ThreadPoolExecutor(max_workers=self.args.workers) as pool:
            futures = {pool.submit(self.import_one, row): row for row in self.rows}
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as error:
                    failures.append({"file": futures[future]["file"], "error": str(error)})
        report.update({"uploadedAssets": self.uploaded, "reusedAssets": self.reused, "savedLibraryRows": self.saved,
                       "unchangedLibraryRows": self.unchanged, "failures": failures})
        helpers.write(HERE / ".local-state" / "skill-images-receipt.json", report)
        print(json.dumps(report, ensure_ascii=False), flush=True)
        if failures:
            raise RuntimeError("Some skill icons could not be imported; inspect the ignored local receipt.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend", default="http://localhost:8080")
    parser.add_argument("--keycloak", default="http://localhost:8081")
    parser.add_argument("--workers", type=int, choices=range(1, 4), default=3)
    parser.add_argument("--apply", action="store_true")
    helpers.add_upload_host_argument(parser)
    args = parser.parse_args()
    args.backend = helpers.helpers.loopback(args.backend)
    args.keycloak = helpers.helpers.loopback(args.keycloak)
    Importer(args).run()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    try:
        main()
    except Exception as error:
        print(type(error).__name__ + ": " + str(error), file=sys.stderr)
        raise SystemExit(1)
