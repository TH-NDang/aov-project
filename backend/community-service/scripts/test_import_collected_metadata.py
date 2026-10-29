"""Check import safety without credentials, network access or database writes."""

import importlib.util
import json
import tempfile
import unittest
import urllib.error
from contextlib import contextmanager
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "metadata_import", Path(__file__).with_name("import-collected-metadata.py"),
)
IMPORT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(IMPORT)


@contextmanager
def workspace_fixture():
    parent = (IMPORT.ROOT / ".local-state/tournament-metadata-import/tests").resolve()
    parent.relative_to(IMPORT.ROOT.resolve())
    parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=parent) as temporary:
        path = Path(temporary).resolve()
        path.relative_to(parent)
        yield path


class FakeClient:
    def __init__(self, document=None, lose_create_response=False):
        self.document = document
        self.lose_create_response = lose_create_response
        self.creates = 0

    def find_code(self, kind, code):
        return self.document

    def request(self, path, content=None):
        if content is not None:
            self.creates += 1
            self.document = {"id": "created-id", "content": content}
            if self.lose_create_response:
                raise urllib.error.URLError("Connection closed after the server accepted the request")
        return self.document


class MetadataImportTest(unittest.TestCase):
    def test_unknown_dates_and_provisional_logos_are_not_promoted(self):
        with workspace_fixture() as root:
            event = {
                "code": "verified-event", "name": "Verified event", "regions": ["TH"],
                "status": "SCHEDULE_ENDED_RESULT_REVIEW_REQUIRED", "sourceIds": ["official"],
                "dateScopeVerification": "VERIFIED", "teamCodes": ["verified-team"],
                "participantVerification": IMPORT.PRIMARY_PARTICIPANTS,
                "dates": {"start": "2026-06-27", "end": "2026-08-09", "startEvidence": "SECONDARY_RESEARCH"},
            }
            team = {
                "code": "verified-team", "name": "Old team name", "displayNameAtEvent": "Verified seasonal name",
                "region": "TH", "logo": "fallback.png", "logoReviewRequired": True,
            }
            candidate = {**event, "code": "unknown-boundary", "dateScopeVerification": "UNVERIFIED"}
            manifest = {
                "schemaVersion": 1,
                "sources": [{"id": "official", "kind": "PRIMARY_ORGANIZER", "url": "https://example.com/event"}],
                "assets": [{
                    "path": "fallback.png", "sourceUrl": "https://secondary.example/logo.png",
                    "provenance": "SECONDARY_RESEARCH",
                }],
                "tournaments": [{"path": "event.json"}, {"path": "candidate.json"}],
                "teams": [{"path": "team.json"}],
            }
            fixture_files = (
                ("manifest.json", manifest), ("event.json", event), ("candidate.json", candidate), ("team.json", team),
            )
            for name, content in fixture_files:
                (root / name).write_text(json.dumps(content), encoding="utf-8")

            plan, skipped = IMPORT.build_plan(root / "manifest.json")

            team_content = next(item["content"] for item in plan if item["kind"] == "teams")
            tournament_content = next(item["content"] for item in plan if item["kind"] == "tournaments")
            self.assertEqual("Verified seasonal name", team_content["name"])
            self.assertIsNone(team_content["logoUrl"])
            self.assertIsNone(tournament_content["startsOn"])
            self.assertEqual("2026-08-09", tournament_content["endsOn"])
            self.assertIn("unknown-boundary", [item["code"] for item in skipped])

    def test_rerun_preserves_existing_editor_changes(self):
        expected = {"code": "existing-team", "name": "Collected name"}
        client = FakeClient({"id": "existing-id", "content": {**expected, "name": "Manually edited name"}})

        result = IMPORT.import_operation(client, {"kind": "teams", "code": expected["code"], "content": expected})

        self.assertEqual("EXISTING_DIFFERENT_REVIEW_REQUIRED", result["action"])
        self.assertEqual(0, client.creates)
        self.assertEqual("Manually edited name", client.document["content"]["name"])

    def test_lost_create_response_is_reconciled_without_duplicate_write(self):
        content = {"code": "created-team", "name": "Created team"}
        client = FakeClient(lose_create_response=True)
        operation = {"kind": "teams", "code": content["code"], "content": content}

        first = IMPORT.import_operation(client, operation)
        second = IMPORT.import_operation(client, operation)

        self.assertEqual("RECOVERED_CREATED", first["action"])
        self.assertEqual("EXISTING_UNCHANGED", second["action"])
        self.assertEqual(1, client.creates)

    def test_ui_fixture_codes_and_external_manifest_paths_are_rejected(self):
        with self.assertRaises(ValueError):
            IMPORT.checked_code("ui-check-team-blue")
        with workspace_fixture() as temporary:
            with self.assertRaises(ValueError):
                IMPORT.related_file(temporary, "../outside.json")

    def test_bearer_tokens_cannot_be_sent_to_remote_plain_http(self):
        with self.assertRaises(ValueError):
            IMPORT.CommunityClient("http://example.com/api/community/v1", "test-token")


if __name__ == "__main__":
    unittest.main()
