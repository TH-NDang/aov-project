"""Audit resource attribution and optionally backfill existing cloud media by verified SHA-256."""
import argparse
from collections import Counter
import importlib.util
import json
from pathlib import Path
from source_credits import source_index

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend", help="Wiki API root, including /api/wiki/v1")
    parser.add_argument("--keycloak", default="http://localhost:8081")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--output", type=Path, default=ROOT / "backend/wiki-service/.local-state/media-sources-report.json")
    args = parser.parse_args()
    if args.apply and not args.backend:
        parser.error("--apply requires --backend")
    index = source_index()
    by_hash = {}
    for row in index:
        if row.get("sha256"):
            by_hash.setdefault(row["sha256"], row["source"])
    inventory = json.loads((ROOT / "resources/Lien-Quan-v3/data/danh-sach-tai-nguyen.json").read_text(encoding="utf-8"))["assets"]
    supported = [row for row in inventory if Path(row["file"]).suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}]
    report = {"resourceAssets": len(inventory), "supportedAssets": len(supported),
              "matchedAssets": sum(row.get("sha256") in by_hash for row in supported),
              "unmatched": [row["file"] for row in supported if row.get("sha256") not in by_hash],
              "sourceGroups": dict(Counter(row["source"]["label"] for row in index)),
              "applied": 0, "scannedAssets": 0, "scannedVersions": 0, "alreadyAttributedVersions": 0,
              "planned": [], "unmatchedCloudVersions": []}
    if args.backend:
        spec = importlib.util.spec_from_file_location("source_import_api", ROOT / "research/patches/2026/import-patches.py")
        helper = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(helper)
        api = helper.Api(args.backend, args.keycloak)
        page = 0
        while True:
            assets = api.call(f"/admin/media/assets?page={page}&size=100")
            for summary in assets["items"]:
                if summary["state"] != "ACTIVE" or summary["semanticType"] == "USER_AVATAR":
                    continue
                asset = api.call("/admin/media/assets/" + summary["id"])
                report["scannedAssets"] += 1
                for version in asset["versions"]:
                    report["scannedVersions"] += 1
                    source = by_hash.get(version["sha256"])
                    if not source:
                        report["unmatchedCloudVersions"].append({"assetId": asset["id"], "versionId": version["id"],
                                                                "sha256": version["sha256"],
                                                                "semanticType": asset["semanticType"],
                                                                "current": version["current"], "url": version["url"],
                                                                "provenance": asset.get("provenance", [])})
                        continue
                    if any(row.get("versionId") == version["id"] and all(row.get(key) == value for key, value in source.items())
                           for row in asset.get("provenance", [])):
                        report["alreadyAttributedVersions"] += 1
                        continue
                    report["planned"].append({"assetId": asset["id"], "versionId": version["id"], "source": source})
                    if args.apply:
                        api.call(f'/admin/media/assets/{asset["id"]}/versions/{version["id"]}/sources', "POST", source)
                        report["applied"] += 1
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f'Scanned assets: {report["scannedAssets"]}; versions: {report["scannedVersions"]}; '
                  f'planned: {len(report["planned"])}; applied: {report["applied"]}', flush=True)
            if (page + 1) * 100 >= assets["totalElements"]:
                break
            page += 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key not in {"planned", "sourceGroups", "unmatchedCloudVersions"}}, ensure_ascii=False))
    print(f'Planned versions: {len(report["planned"])}; report: {args.output}')


if __name__ == "__main__":
    main()
