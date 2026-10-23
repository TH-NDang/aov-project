"""Import the resource warehouse as reviewable drafts through public admin APIs."""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import copy
import hashlib
import importlib.util
import json
import mimetypes
from pathlib import Path
import sys
import threading
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RESOURCES = ROOT / "resources" / "Lien-Quan-v3"
STATE = HERE / ".local-state"
LOCALE = "vi-VN"
SOURCES = {"items": "trang-bi", "enchantments": "phu-hieu", "arcana": "ngoc", "spells": "phu-tro"}
SEMANTICS = {"items": "ITEM_ICON", "enchantments": "ENCHANTMENT_ICON", "arcana": "ARCANA_ICON", "spells": "SPELL_ICON"}
VARIANT_KEYS = {"Đại địa": "earth", "Liệt hoả": "fire"}
STAT_KEYS = {
    "Công phép": "magic-attack", "Công vật lý": "physical-attack", "Công vậy lý": "physical-attack",
    "Giáp": "armor", "Giáp phép": "magic-defense", "Giảm hồi chiêu": "cooldown-reduction",
    "Hút máu": "physical-lifesteal", "Hút máu phép": "magic-lifesteal", "Hồi máu/5s": "health-regen-per-five-seconds",
    "Máu tối đa": "max-health", "Sát thương chí mạng": "critical-damage", "Tốc chạy": "movement-speed",
    "Tốc đánh": "attack-speed", "Tỷ lệ chí mạng": "critical-chance", "Xuyên giáp": "armor-penetration",
    "Xuyên giáp phép": "magic-penetration",
}

image_spec = importlib.util.spec_from_file_location("warehouse_media_helpers", ROOT / "research/character-images/import-images.py")
image_helpers = importlib.util.module_from_spec(image_spec)
image_spec.loader.exec_module(image_helpers)
read, write = image_helpers.read, image_helpers.write


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def resource_file(value, resources=RESOURCES):
    if not isinstance(value, str) or not value.startswith("assets/") or "\\" in value:
        raise ValueError("An image must use a package-relative assets path.")
    path = (resources / value).resolve()
    if not path.is_relative_to(resources.resolve()) or not path.is_file():
        raise ValueError(f"Missing or unsafe resource image: {value}")
    return path


def source_note(source_file, collected_on, record, extra=None):
    value = {"importer": "warehouse-resources-v1", "sourceFile": "data/" + source_file + ".json",
             "collectedOn": collected_on, "baseline": True, "source": record}
    if extra:
        value["evidence"] = extra
    result = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if len(result) > 32768:
        raise ValueError("Source provenance exceeds the backend notes limit.")
    return result


def translation(source, description=None):
    return {"locale": LOCALE, "name": source["name"], "summary": source.get("summary"),
            "description": source.get("description") if description is None else description,
            "statLabels": {}, "variantLabels": {}, "effects": []}


def content_for(kind, source, catalog, item_evidence=None):
    """Keep language-dependent labels separate from mechanics and stable relationships."""
    common = {"iconAssetId": None, "translations": [translation(source)],
              "notes": source_note(SOURCES[kind], catalog.get("collectedOn"), source, item_evidence)}
    if kind == "items":
        categories = {item["name"]: item["id"] for item in catalog["categories"]}
        common["translations"][0]["variantLabels"] = {VARIANT_KEYS[position["variant"]]: position["variant"]
            for position in source["shopPositions"] if position.get("variant")}
        return {**common, "tier": source["tier"], "price": source["price"],
                "categoryCode": categories[source["category"]],
                "shopPositions": [{"categoryCode": categories[position["group"]], "row": position["row"],
                                   "column": position["column"], "variant": VARIANT_KEYS[position["variant"]] if position.get("variant") else None}
                                  for position in source["shopPositions"]],
                "recipeStatus": {"none": "NONE", "verified": "VERIFIED", "unverified": "UNKNOWN"}[source["recipe"]["status"]],
                "components": [], "stats": []}
    if kind == "arcana":
        labels, stats = {}, []
        for attribute in source["attributes"]:
            key = STAT_KEYS[attribute["name"]]
            labels[key] = attribute["name"]
            stats.append({"key": key, "value": attribute["value"], "unit": attribute.get("unit")})
        common["translations"][0].update({"description": source.get("attributes_text") or None, "statLabels": labels})
        return {**common, "color": {"Đỏ": "RED", "Tím": "PURPLE", "Xanh": "GREEN"}[source["color"]],
                "tier": source["level"], "stats": stats}
    if kind == "enchantments":
        return {**common, "branchCode": source["groupId"], "tier": source["tier"], "position": source["position"]["column"]}
    if kind == "spells":
        unlock = source.get("unlock") or {}
        charges = source.get("charges") or {}
        return {**common, "cooldownSeconds": (source.get("cooldown") or {}).get("seconds"),
                "unlockLevel": unlock.get("level"),
                "unlockType": {"account-creation": "ACCOUNT_CREATION", "level": "LEVEL"}.get(unlock.get("type"), "UNKNOWN"),
                "chargeRechargeSeconds": charges.get("rechargeSeconds"), "maxCharges": charges.get("max"),
                "availability": {"available": "AVAILABLE", "removed": "REMOVED"}.get(source["availability"]["status"], "UNKNOWN"),
                "legacy": source["legacy"], "displayOrder": catalog["items"].index(source),
                "defaultStateKey": source.get("defaultStateId"),
                "states": [{"key": state["id"], "iconAssetId": None, "translations": [translation(state)]}
                           for state in source.get("states", [])], "referenceImages": []}
    raise ValueError(f"Unknown catalog kind: {kind}")


def media_for(kind, source, catalog, evidence=None):
    """Return only images actually bound by a mapped backend field."""
    result = []
    image = source.get("image")
    path = image.get("file") if isinstance(image, dict) else image
    provenance = image if isinstance(image, dict) else (source.get("source") or {}).get("image", {})
    if kind == "items":
        provenance = (evidence or {}).get("image", {})
    elif kind == "arcana":
        provenance = {"sourceUrl": source.get("image_url"), "page": source.get("source_page")}
    if path:
        result.append({"field": "iconAssetId", "path": path, "semantic": SEMANTICS[kind], "provenance": provenance})
    if kind == "spells":
        for index, state in enumerate(source.get("states", [])):
            if state.get("image"):
                result.append({"field": f"states.{index}.iconAssetId", "path": state["image"], "semantic": SEMANTICS[kind],
                               "provenance": state.get("imageSource") or {}})
        for reference in source.get("referenceImages", []):
            result.append({"field": "referenceImages", "path": reference["image"], "semantic": SEMANTICS[kind],
                           "provenance": reference.get("source") or {}, "notes": reference.get("reason")})
    return result


def validate_recipes(items):
    by_code = {item["id"]: item for item in items}
    if len(by_code) != len(items):
        raise ValueError("Duplicate item code in the source catalog.")
    done, active = set(), set()

    def visit(code):
        if code in active:
            raise ValueError(f"Recipe cycle at {code}.")
        if code in done:
            return
        active.add(code)
        recipe = by_code[code]["recipe"]
        if recipe["status"] != "verified" and recipe["components"]:
            raise ValueError("Unverified recipe components cannot become confirmed relationships.")
        seen = set()
        for component in recipe["components"]:
            target = component["itemId"]
            if target not in by_code or target in seen or not isinstance(component["quantity"], int) or component["quantity"] <= 0:
                raise ValueError(f"Invalid recipe component for {code}.")
            seen.add(target)
            visit(target)
        active.remove(code)
        done.add(code)

    for code in by_code:
        visit(code)


def load_plan(resources=RESOURCES):
    catalogs = {kind: read(resources / "data" / (name + ".json")) for kind, name in SOURCES.items()}
    evidence = {row["itemId"]: row for row in read(resources / "data/trang-bi-nguon-du-lieu.json")["items"]}
    validate_recipes(catalogs["items"]["items"])
    rows, media = [], []
    for kind, catalog in catalogs.items():
        codes = set()
        for source in catalog["items"]:
            if source["id"] in codes:
                raise ValueError(f"Duplicate {kind} code: {source['id']}")
            codes.add(source["id"])
            item_evidence = evidence.get(source["id"]) if kind == "items" else None
            images = media_for(kind, source, catalog, item_evidence)
            rows.append({"kind": kind, "code": source["id"], "source": source,
                         "content": content_for(kind, source, catalog, item_evidence), "media": images})
            media.extend(images)
    metadata = []
    for category in catalogs["items"]["categories"]:
        metadata.append({"kind": "item-categories", "code": category["id"], "content": {
            "displayOrder": category["index"], "iconAssetId": None, "backgroundAssetId": None, "color": None,
            "translations": [{"locale": LOCALE, "name": category["name"], "description": None, "suitability": None}]}, "media": []})
    for branch in catalogs["enchantments"]["groups"]:
        images = [{"field": field, "path": branch[key]["file"], "semantic": semantic, "provenance": branch[key]}
                  for key, field, semantic in [("icon", "iconAssetId", "ENCHANTMENT_ICON"), ("background", "backgroundAssetId", "OTHER")]]
        media.extend(images)
        metadata.append({"kind": "enchantment-branches", "code": branch["id"], "content": {
            "displayOrder": branch["order"], "iconAssetId": None, "backgroundAssetId": None, "color": None,
            "translations": [{"locale": LOCALE, "name": branch["name"], "description": branch.get("description"), "suitability": None}]}, "media": images})
    unique = {}
    for image in media:
        file = resource_file(image["path"], resources)
        data = file.read_bytes()
        if data.startswith(b"version https://git-lfs.github.com/spec/"):
            raise ValueError(f"Git LFS bytes are unavailable: {image['path']}")
        key = image["semantic"] + ":" + image["path"]
        sha = hashlib.sha256(data).hexdigest()
        if image["provenance"].get("sha256") and image["provenance"]["sha256"] != sha:
            raise ValueError(f"The source provenance hash differs from the image bytes: {image['path']}")
        unique.setdefault(key, {**image, "sha256": sha, "sizeBytes": len(data)})
    source_files = [*SOURCES.values(), "trang-bi-nguon-du-lieu"]
    return {"schemaVersion": 1, "catalogs": catalogs, "rows": rows, "metadata": metadata, "media": list(unique.values()),
            "sourceHashes": {"data/" + name + ".json": hashlib.sha256((resources / "data" / (name + ".json")).read_bytes()).hexdigest()
                             for name in source_files},
            "summary": {"records": {kind: len(catalog["items"]) for kind, catalog in catalogs.items()},
                        "media": len(unique), "metadata": len(metadata),
                        "verifiedRecipeEdges": sum(len(row["recipe"]["components"]) for row in catalogs["items"]["items"]),
                        "unknownRecipes": [row["id"] for row in catalogs["items"]["items"] if row["recipe"]["status"] == "unverified"],
                        "arcanaWithoutStats": [row["id"] for row in catalogs["arcana"]["items"] if not row["attributes"]]}}


def all_pages(api, path, **query):
    rows, page = [], 0
    while True:
        result = api.call(path + "?" + urlencode({"page": page, "size": 100, **query}))
        if isinstance(result, list):
            return result
        rows.extend(result["items"])
        if len(rows) >= result["totalElements"] or not result["items"]:
            return rows
        page += 1


def with_media(content, images, asset_ids):
    result = copy.deepcopy(content)
    for image in images:
        asset_id = asset_ids[image["semantic"] + ":" + image["path"]]
        if image["field"] == "referenceImages":
            result["referenceImages"].append({"assetId": asset_id, "notes": image.get("notes")})
        elif image["field"].startswith("states."):
            result["states"][int(image["field"].split(".")[1])]["iconAssetId"] = asset_id
        else:
            result[image["field"]] = asset_id
    return result


def initial_content(row):
    result = copy.deepcopy(row["content"])
    if row["kind"] == "items" and result["recipeStatus"] == "VERIFIED":
        result["recipeStatus"] = "UNKNOWN"
    return result


class Importer:
    def __init__(self, args, plan):
        self.args, self.plan = args, plan
        self.api = image_helpers.helpers.Api(args.backend, args.keycloak)
        self.checkpoint_file = STATE / "checkpoint.json"
        self.state = read(self.checkpoint_file) if self.checkpoint_file.exists() else {
            "schemaVersion": 1, "backend": args.backend.rstrip("/"), "ruleset": args.ruleset,
            "assets": {}, "records": {}, "metadata": {}}
        if self.state["backend"] != args.backend.rstrip("/") or self.state["ruleset"] != args.ruleset:
            raise ValueError("The checkpoint belongs to a different backend or ruleset.")
        self.lock = threading.RLock()
        self.uploaded, self.reused = 0, 0
        self.ruleset = next(row for row in self.api.call("/admin/rulesets") if row["code"] == args.ruleset)

    def checkpoint(self):
        with self.lock:
            write(self.checkpoint_file, self.state)

    def upload(self, image):
        file = resource_file(image["path"])
        data = file.read_bytes()
        content_type = mimetypes.guess_type(file.name)[0]
        if content_type not in {"image/png", "image/jpeg", "image/webp"} or not data or len(data) > 25 * 1024 * 1024:
            raise ValueError(f"Unsupported media: {image['path']}")
        if hashlib.sha256(data).hexdigest() != image["sha256"]:
            raise ValueError("Resource bytes changed after creating the import plan.")
        key = image["semantic"] + ":" + image["path"]
        with self.lock:
            entry = self.state["assets"].get(key)
        if entry and entry["sha256"] != image["sha256"]:
            raise ValueError(f"Resource bytes changed after checkpoint: {image['path']}")
        if entry and entry.get("complete"):
            asset = self.api.call("/admin/media/assets/" + entry["assetId"])
            if asset["semanticType"] != image["semantic"] or asset["state"] != "ACTIVE" or not asset.get("currentVersionId"):
                raise ValueError("A checkpoint media asset is no longer active or has a different semantic type.")
            with self.lock:
                self.reused += 1
            return entry["assetId"]
        if not entry:
            provenance = image["provenance"]
            note = json.dumps({"path": image["path"], "sha256": image["sha256"], "source": provenance}, ensure_ascii=False)
            official = urlparse(provenance.get("sourceUrl") or "").hostname == "lienquan.garena.vn" and not provenance.get("derived")
            created = self.api.call("/admin/media/assets", "POST", {"semanticType": image["semantic"], "source": {
                "type": "OFFICIAL" if official else "OTHER", "label": "Tài nguyên Kho trang bị",
                "url": provenance.get("sourceUrl"), "note": note}})
            entry = {"assetId": created["id"], "sha256": image["sha256"], "complete": False}
            with self.lock:
                self.state["assets"][key] = entry
                self.checkpoint()
        if entry.get("uploadId"):
            try:
                result = self.api.call("/admin/media/uploads/" + entry["uploadId"] + "/complete", "POST")
                if result["current"]:
                    with self.lock:
                        entry["complete"] = True
                        self.reused += 1
                        self.checkpoint()
                    return entry["assetId"]
            except RuntimeError:
                pass
        ticket = self.api.call("/admin/media/assets/" + entry["assetId"] + "/version-uploads", "POST", {
            "fileName": file.name, "contentType": content_type, "sizeBytes": len(data)})
        with self.lock:
            entry["uploadId"] = ticket["uploadId"]
            self.checkpoint()
        try:
            image_helpers.upload_ticket(ticket, data, getattr(self.args, "upload_host", ()))
        except HTTPError as error:
            raise RuntimeError(f"Object storage upload failed with HTTP {error.code}: {image['path']}") from None
        completed = self.api.call("/admin/media/uploads/" + ticket["uploadId"] + "/complete", "POST")
        if not completed["current"]:
            raise RuntimeError("The imported image is not the current media version.")
        with self.lock:
            entry["complete"] = True
            self.uploaded += 1
            self.checkpoint()
        return entry["assetId"]

    def upload_all(self):
        asset_ids = {}
        self.api.authenticate()
        with ThreadPoolExecutor(max_workers=self.args.workers) as executor:
            tasks = {executor.submit(self.upload, image): image for image in self.plan["media"]}
            for index, task in enumerate(as_completed(tasks), start=1):
                image = tasks[task]
                asset_ids[image["semantic"] + ":" + image["path"]] = task.result()
                if index % 25 == 0 or index == len(tasks):
                    print(f"Media processed: {index}/{len(tasks)}; uploaded: {self.uploaded}; reused: {self.reused}", flush=True)
        return asset_ids

    def metadata(self, asset_ids):
        for row in self.plan["metadata"]:
            key = row["kind"] + ":" + row["code"]
            current = next((item for item in self.api.call("/admin/" + row["kind"]) if item["code"] == row["code"]), None)
            expected = with_media(row["content"], row["media"], asset_ids)
            if current and all(current.get(field) == value for field, value in expected.items()):
                continue
            receipt = self.state["metadata"].get(key)
            if current and (not receipt or digest({field: current.get(field) for field in expected}) != receipt["digest"]):
                raise ValueError(f"Existing metadata has external edits; review before importing: {key}")
            result = self.api.call("/admin/" + row["kind"] + "/" + row["code"], "PUT", {
                **expected, "expectedVersion": current["version"] if current else 0})
            self.state["metadata"][key] = {"digest": digest({field: result.get(field) for field in expected})}
            self.checkpoint()

    def identities(self):
        identities = {}
        for kind in SOURCES:
            identities[kind] = {row["code"]: row for row in all_pages(self.api, "/admin/" + kind, rulesetId=self.ruleset["id"])}
        for row in self.plan["rows"]:
            key = row["kind"] + ":" + row["code"]
            identity = identities[row["kind"]].get(row["code"])
            if identity:
                entry = self.state["records"].get(key)
                if not entry:
                    expected = initial_content(row)
                    if identity["revision"]["state"] != "DRAFT" or {field: identity["content"].get(field) for field in expected} != expected:
                        raise ValueError(f"An existing identity is not an unmodified import draft: {key}")
                    entry = {"id": identity["id"], "draftId": identity["revision"]["id"],
                             "initialDigest": digest(identity["content"])}
                    self.state["records"][key] = entry
                    self.checkpoint()
                if entry["id"] != identity["id"]:
                    raise ValueError("The checkpoint identity no longer matches the backend.")
                continue
            content = initial_content(row)
            created = self.api.call("/admin/" + row["kind"], "POST", {
                "code": row["code"], "rulesetId": self.ruleset["id"], "initialLocale": LOCALE,
                "name": row["source"]["name"], "content": content})
            identities[row["kind"]][row["code"]] = {"id": created["id"], "code": row["code"]}
            self.state["records"][key] = {"id": created["id"], "draftId": created["revision"]["id"],
                                          "initialDigest": digest(created["content"])}
            self.checkpoint()
        return identities

    def apply_records(self, asset_ids, identities):
        for index, row in enumerate(self.plan["rows"], start=1):
            key = row["kind"] + ":" + row["code"]
            receipt = self.state["records"][key]
            path = "/admin/" + row["kind"] + "/" + receipt["id"]
            current = self.api.call(path + "/revisions/" + receipt["draftId"])
            content = with_media(row["content"], row["media"], asset_ids)
            if row["kind"] == "items":
                content["components"] = [{"itemId": identities["items"][component["itemId"]]["id"], "quantity": component["quantity"]}
                                         for component in row["source"]["recipe"]["components"]]
            expected_fields = {field: current["content"].get(field) for field in content}
            if expected_fields == content:
                receipt["digest"] = digest(current["content"])
                receipt["sourceDigest"] = digest(row["source"])
                self.checkpoint()
                continue
            if current["revision"]["state"] != "DRAFT":
                raise ValueError(f"The imported draft was published or discarded: {key}")
            if digest(current["content"]) != receipt.get("digest", receipt["initialDigest"]):
                raise ValueError(f"The draft contains external edits; refusing to overwrite: {key}")
            result = self.api.call(path + "/drafts/" + receipt["draftId"], "PUT", {
                "expectedVersion": current["revision"]["version"], "content": content,
                "changeNote": "Import resource baseline for review; collection date is not a patch attribution."})
            receipt.update({"digest": digest(result["content"]), "sourceDigest": digest(row["source"])})
            self.checkpoint()
            if index % 25 == 0 or index == len(self.plan["rows"]):
                print(f"Drafts saved: {index}/{len(self.plan['rows'])}", flush=True)

    def verify(self):
        counts = {kind: 0 for kind in SOURCES}
        asset_ids = {key: entry["assetId"] for key, entry in self.state["assets"].items() if entry.get("complete")}
        for row in self.plan["metadata"]:
            current = next((item for item in self.api.call("/admin/" + row["kind"]) if item["code"] == row["code"]), None)
            expected = with_media(row["content"], row["media"], asset_ids)
            if current is None or any(current.get(field) != value for field, value in expected.items()):
                raise ValueError(f"Imported metadata differs from the source plan: {row['kind']}:{row['code']}")
        for row in self.plan["rows"]:
            key = row["kind"] + ":" + row["code"]
            receipt = self.state["records"].get(key)
            if not receipt or not receipt.get("digest"):
                raise ValueError(f"Import has not completed for {key}")
            current = self.api.call("/admin/" + row["kind"] + "/" + receipt["id"] + "/revisions/" + receipt["draftId"])
            if current["revision"]["state"] != "DRAFT" or digest(current["content"]) != receipt["digest"]:
                raise ValueError(f"Imported content differs from the verified checkpoint: {key}")
            if receipt["sourceDigest"] != digest(row["source"]):
                raise ValueError(f"Source content changed since the import: {key}")
            counts[row["kind"]] += 1
        for image in self.plan["media"]:
            entry = self.state["assets"].get(image["semantic"] + ":" + image["path"])
            if not entry or not entry.get("complete") or entry["sha256"] != image["sha256"]:
                raise ValueError("Media checkpoint is incomplete.")
            asset = self.api.call("/admin/media/assets/" + entry["assetId"])
            if asset["state"] != "ACTIVE" or asset["semanticType"] != image["semantic"] or not asset.get("currentVersionId"):
                raise ValueError("An imported media asset is not active.")
        result = {"schemaVersion": 1, "ruleset": self.args.ruleset, "drafts": counts,
                  "media": len(self.plan["media"]), "metadata": len(self.plan["metadata"]),
                  "sourceHashes": self.plan["sourceHashes"],
                  "verifiedRecipeEdges": self.plan["summary"]["verifiedRecipeEdges"],
                  "unknownRecipes": self.plan["summary"]["unknownRecipes"], "arcanaWithoutStats": self.plan["summary"]["arcanaWithoutStats"]}
        write(STATE / "verification.json", result)
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="Upload media and save drafts; never publish.")
    mode.add_argument("--verify", action="store_true", help="Read the backend and verify an existing checkpoint.")
    parser.add_argument("--backend", default="http://localhost:8080")
    parser.add_argument("--keycloak", default="http://localhost:8081")
    parser.add_argument("--ruleset", default="aov-standard")
    parser.add_argument("--workers", type=int, choices=range(1, 4), default=3)
    image_helpers.add_upload_host_argument(parser)
    args = parser.parse_args()
    plan = load_plan()
    print(json.dumps(plan["summary"], ensure_ascii=False, indent=2), flush=True)
    write(STATE / "preview.json", plan)
    if not args.apply and not args.verify:
        print("Preview only. Use --apply to upload media and create reviewable drafts.")
        return
    importer = Importer(args, plan)
    if args.apply:
        assets = importer.upload_all()
        importer.metadata(assets)
        identities = importer.identities()
        importer.apply_records(assets, identities)
    print(json.dumps(importer.verify(), ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
