"""Import verified collected team and tournament metadata without publishing games."""

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_MANIFEST = ROOT / "resources/esports/2026-post-apl/manifest.json"
REPORT_DIRECTORY = ROOT / ".local-state/tournament-metadata-import"
CODE = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
PRIMARY_PARTICIPANTS = "PRIMARY_NAMES_WITH_SECONDARY_IDENTIFIERS"


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def related_file(root, relative_path):
    result = (root / relative_path).resolve()
    result.relative_to(root.resolve())
    if not result.is_file():
        raise ValueError(f"Collected file is missing: {relative_path}")
    return result


def checked_code(value):
    if not isinstance(value, str) or not CODE.fullmatch(value) or value.startswith("ui-check"):
        raise ValueError("Import codes must be slugs outside the UI test namespace.")
    return value


def checked_url(value):
    if not value:
        return None
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme not in ("https", "http") or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Source URLs must use HTTP(S) without embedded credentials.")
    return value


def known_date(value):
    if value is None:
        return None
    return date.fromisoformat(value).isoformat()


def tournament_note(event, sources):
    evidence = [sources[source_id] for source_id in event.get("sourceIds", []) if source_id in sources]
    lines = [
        f"Imported as editorial metadata from the collection reviewed {event.get('statusAsOf', 'unknown')}.",
        f"Verification: {event.get('status', 'UNKNOWN')}; date scope: {event.get('dateScopeVerification', 'UNKNOWN')}.",
        "No matches, game results, gameplay patch or unverified rosters were imported or published.",
    ]
    if event.get("overlapsDateBoundary"):
        lines.append("This competition overlaps the post-July collection boundary.")
    if event.get("dates", {}).get("startEvidence") == "SECONDARY_RESEARCH":
        lines.append("The full competition start date is unverified and was intentionally left empty.")
    for phase in event.get("phases", []):
        if phase.get("sourceIds") and phase.get("start") and phase.get("end"):
            lines.append(f"Verified phase: {phase['name']} {phase['start']} through {phase['end']}.")
    for gap in event.get("gaps", []):
        lines.append("Review gap: " + gap)
    for source in evidence:
        if source.get("url"):
            lines.append(f"Source [{source['kind']}]: {checked_url(source['url'])}")
    return "\n".join(lines)


def build_plan(manifest_path):
    manifest = read_json(manifest_path)
    if manifest.get("schemaVersion") != 1:
        raise ValueError("Only collection schemaVersion 1 is supported.")

    folder = manifest_path.parent
    sources = {source["id"]: source for source in manifest.get("sources", [])}
    assets = {asset["path"]: asset for asset in manifest.get("assets", [])}
    events = [read_json(related_file(folder, event["path"])) for event in manifest.get("tournaments", [])]
    teams = [read_json(related_file(folder, team["path"])) for team in manifest.get("teams", [])]
    team_evidence = {}
    for event in events:
        if event.get("participantVerification") == PRIMARY_PARTICIPANTS:
            for code in event.get("teamCodes", []):
                team_evidence.setdefault(code, []).extend(event.get("sourceIds", []))

    operations = []
    skipped = []
    for team in teams:
        code = checked_code(team["code"])
        if code not in team_evidence:
            skipped.append({
                "kind": "teams", "code": code, "reason": "Participant identity requires primary-source review.",
            })
            continue

        name = team.get("displayNameAtEvent") or team.get("name")
        if not name:
            raise ValueError(f"Team name is required: {code}")
        logo = assets.get(team.get("logo"))
        logo_url = None
        if logo and not team.get("logoReviewRequired", True) and logo.get("provenance") == "PRIMARY_ORGANIZER":
            logo_url = checked_url(logo.get("sourceUrl"))

        operations.append({
            "kind": "teams", "code": code,
            "content": {
                "code": code, "name": name, "shortName": team.get("shortName"),
                "country": team.get("region"), "logoUrl": logo_url,
            },
            "evidence": {
                "sourceIds": sorted(set(team_evidence[code])), "division": team.get("division"),
                "logoPolicy": "PRIMARY_REMOTE_URL" if logo_url else "OMITTED_UNVERIFIED_OR_UNAVAILABLE",
            },
        })

    for event in events:
        code = checked_code(event["code"])
        if event.get("dateScopeVerification") == "UNVERIFIED":
            skipped.append({
                "kind": "tournaments", "code": code,
                "reason": "Occurrence within the requested date boundary is unverified.",
            })
            continue
        evidence = [sources[source_id] for source_id in event.get("sourceIds", []) if source_id in sources]
        primary = [source for source in evidence if source.get("kind", "").startswith("PRIMARY") and source.get("url")]
        if not primary:
            skipped.append({
                "kind": "tournaments", "code": code, "reason": "No primary tournament metadata source is available.",
            })
            continue

        dates = event.get("dates", {})
        starts_on = None if dates.get("startEvidence") == "SECONDARY_RESEARCH" else known_date(dates.get("start"))
        ends_on = known_date(dates.get("end"))
        if starts_on and ends_on and starts_on > ends_on:
            raise ValueError(f"Tournament dates are reversed: {code}")

        year_in_code = re.search(r"(?:^|-)(\d{4})(?:-|$)", code)
        operations.append({
            "kind": "tournaments", "code": code,
            "content": {
                "code": code, "name": event["name"], "region": "/".join(event["regions"]),
                "year": int(year_in_code.group(1)) if year_in_code else None,
                "startsOn": starts_on, "endsOn": ends_on,
                "sourceUrl": checked_url(primary[0]["url"]), "note": tournament_note(event, sources),
            },
            "evidence": {
                "sourceIds": event.get("sourceIds", []),
                "dateScopeVerification": event.get("dateScopeVerification"),
            },
        })

    keys = [(item["kind"], item["code"]) for item in operations]
    if len(set(keys)) != len(keys):
        raise ValueError("The import plan contains duplicate entity codes.")
    return operations, skipped


class ApiFailure(RuntimeError):
    def __init__(self, status, path):
        super().__init__(f"Community API returned HTTP {status} for {path}.")
        self.status = status


class CommunityClient:
    def __init__(self, base_url, token):
        self.base_url = checked_url(base_url).rstrip("/")
        self.token = token
        parsed = urllib.parse.urlsplit(self.base_url)
        if parsed.scheme != "https" and parsed.hostname not in ("localhost", "127.0.0.1", "::1"):
            raise ValueError("Remote authenticated API connections require HTTPS.")

    def request(self, path, content=None):
        headers = {"Accept": "application/json", "Authorization": "Bearer " + self.token}
        payload = None if content is None else json.dumps({"content": content}, ensure_ascii=False).encode("utf-8")
        if payload is not None:
            headers["Content-Type"] = "application/json; charset=utf-8"
        request = urllib.request.Request(
            self.base_url + path, data=payload, headers=headers, method="GET" if payload is None else "POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            raise ApiFailure(error.code, path) from None

    def list_documents(self, kind, query=""):
        documents = []
        page = 0
        while True:
            values = urllib.parse.urlencode({"q": query, "page": page, "size": 100})
            result = self.request(f"/admin/{kind}?{values}")
            items = result["items"]
            documents.extend(items)
            if not items or len(documents) >= result["totalElements"]:
                return documents
            page += 1

    def find_code(self, kind, code):
        matches = [item for item in self.list_documents(kind, code) if item["content"]["code"] == code]
        if len(matches) > 1:
            raise RuntimeError(f"Multiple records use the same import code: {kind}/{code}")
        return matches[0] if matches else None


def same_content(actual, expected):
    return all(actual.get(key) == value for key, value in expected.items())


def save_report(path, report):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def import_operation(client, operation):
    kind, code, expected = operation["kind"], operation["code"], operation["content"]
    existing = client.find_code(kind, code)
    if existing:
        action = (
            "EXISTING_UNCHANGED"
            if same_content(existing["content"], expected)
            else "EXISTING_DIFFERENT_REVIEW_REQUIRED"
        )
        return {"kind": kind, "code": code, "id": existing["id"], "action": action}

    try:
        created = client.request(f"/admin/{kind}", expected)
    except (ApiFailure, urllib.error.URLError, TimeoutError) as error:
        if isinstance(error, ApiFailure) and error.status not in (409, 500, 502, 503, 504):
            raise

        recovered = client.find_code(kind, code)
        if recovered and same_content(recovered["content"], expected):
            return {"kind": kind, "code": code, "id": recovered["id"], "action": "RECOVERED_CREATED"}
        raise

    verified = client.request(f"/admin/{kind}/{created['id']}")
    if not same_content(verified["content"], expected):
        raise RuntimeError(f"Created content differs from the reviewed plan: {kind}/{code}")
    return {"kind": kind, "code": code, "id": created["id"], "action": "CREATED"}


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument(
        "--api-base", default=os.environ.get("COMMUNITY_API_BASE", "http://localhost:8082/api/community/v1"),
    )
    parser.add_argument(
        "--token-environment", default="COMMUNITY_IMPORT_ACCESS_TOKEN",
        help="Environment variable containing an existing admin access token; never logged or stored.",
    )
    parser.add_argument(
        "--report", type=Path, help="Receipt path under the repository's ignored .local-state directory.",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--apply", action="store_true",
        help="Create missing metadata through the admin API. Existing content is never overwritten.",
    )
    mode.add_argument(
        "--dry-run", action="store_true",
        help="Build an offline plan without credentials or API writes; this is the default.",
    )
    return parser.parse_args()


def main():
    args = arguments()
    report_path = (args.report or REPORT_DIRECTORY / ("receipt.json" if args.apply else "dry-run.json")).resolve()
    report_path.relative_to((ROOT / ".local-state").resolve())
    manifest_path = args.manifest.resolve()
    operations, skipped = build_plan(manifest_path)
    report = {
        "startedAt": utc_now(), "mode": "APPLY" if args.apply else "DRY_RUN", "manifest": str(manifest_path),
        "manifestSha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
        "apiBase": checked_url(args.api_base), "plan": operations, "skipped": skipped, "results": [],
        "publicationActions": 0, "seriesActions": 0, "gameActions": 0, "rosterActions": 0,
    }
    save_report(report_path, report)
    if args.apply:
        token = os.environ.get(args.token_environment)
        if not token:
            raise ValueError(f"Set {args.token_environment} to an existing authorized access token before applying.")
        client = CommunityClient(args.api_base, token)
        capabilities = set(client.request("/admin/me").get("capabilities", []))
        if not {"tournament:read", "tournament:write"}.issubset(capabilities):
            raise ValueError("The current access token requires tournament:read and tournament:write.")

        try:
            for operation in operations:
                report["results"].append(import_operation(client, operation))
                save_report(report_path, report)
        except Exception as error:
            report.update(status="STOPPED_RETRY_SAFE", stoppedAt=utc_now(), error=str(error))
            save_report(report_path, report)
            raise

    report.update(status="COMPLETE" if args.apply else "PLAN_READY", completedAt=utc_now())
    save_report(report_path, report)
    counts = {kind: sum(item["kind"] == kind for item in operations) for kind in ("teams", "tournaments")}
    actions = {
        action: sum(item["action"] == action for item in report["results"])
        for action in sorted({item["action"] for item in report["results"]})
    }
    print(json.dumps({
        "status": report["status"], "planned": counts, "skipped": len(skipped),
        "actions": actions, "report": str(report_path), "publicationActions": 0,
    }))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError, urllib.error.URLError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
