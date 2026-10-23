"""Verify immutable migration safety and resumability without live cloud credentials."""

import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location("media_migration", Path(__file__).with_name("migrate-media.py"))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
DATA = b"immutable-media-bytes"
ASSET_ID = "ff8d0875-bdb7-49fe-8b43-8ca4070e13a3"
VERSION_ID = "f90da297-8ac3-44c6-b235-de67ec08d903"
KEY = f"assets/{ASSET_ID}/{VERSION_ID}.png"


def row():
    return {"id": VERSION_ID, "asset_id": ASSET_ID, "object_key": KEY,
            "sha256": hashlib.sha256(DATA).hexdigest(), "mime_type": "image/png",
            "size_bytes": len(DATA), "storage_alias": "primary"}


def settings():
    return {"STORAGE_ENDPOINT": "https://" + "a" * 32 + ".r2.cloudflarestorage.com",
            "STORAGE_REGION": "auto", "STORAGE_ASSETS_BUCKET": "aov-media-assets",
            "STORAGE_BUCKET": "aov-media-private", "STORAGE_ACCESS_KEY": "local-test-access",
            "STORAGE_SECRET_KEY": "local-test-secret", "MEDIA_PUBLIC_BASE_URL": "https://img.example.com/assets",
            "SOURCE_STORAGE_ACCESS_KEY": "source-test-access", "SOURCE_STORAGE_SECRET_KEY": "source-test-secret"}


class ServiceError(Exception):
    def __init__(self, code, status):
        self.response = {"Error": {"Code": code}, "ResponseMetadata": {"HTTPStatusCode": status}}


class FakeStorage:
    def __init__(self, objects=None):
        self.objects = copy.deepcopy(objects or {})
        self.puts = []
        self.reads = []
        self.corrupt_put = False
        self.racing_writer = False
        self.head_error = None

    def get_object(self, Bucket, Key):
        self.reads.append((Bucket, Key))
        if (Bucket, Key) not in self.objects:
            raise ServiceError("NoSuchKey", 404)
        stored = self.objects[Bucket, Key]
        return {**stored, "Body": io.BytesIO(stored["data"])}

    def head_object(self, Bucket, Key):
        if self.head_error is not None:
            raise self.head_error
        if (Bucket, Key) not in self.objects:
            raise ServiceError("NoSuchKey", 404)
        return {key: value for key, value in self.objects[Bucket, Key].items() if key != "data"}

    def put_object(self, **request):
        self.puts.append({key: value for key, value in request.items() if key != "Body"})
        if self.racing_writer or (request["Bucket"], request["Key"]) in self.objects:
            raise ServiceError("PreconditionFailed", 412)
        data = request["Body"].read()
        if self.corrupt_put:
            data = b"x" * len(data)
        self.objects[request["Bucket"], request["Key"]] = object_record(data)


def object_record(data=DATA, cache_control=MODULE.CACHE_CONTROL):
    return {"data": data, "ContentLength": len(data), "ContentType": "image/png", "CacheControl": cache_control}


class Response(io.BytesIO):
    def __init__(self, data=DATA, cache="HIT"):
        super().__init__(data)
        self.status = 200
        self.headers = {"Content-Type": "image/png", "Cache-Control": MODULE.CACHE_CONTROL, "CF-Cache-Status": cache}


class FakeOpener:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.urls = []
        self.requests = []

    def open(self, request, timeout):
        self.urls.append(request.full_url)
        self.requests.append(request)
        return next(self.responses)


class MigrationTest(unittest.TestCase):
    def setUp(self):
        test_root = MODULE.SERVICE_ROOT / ".local-state/r2-tool-tests"
        test_root.mkdir(parents=True, exist_ok=True)
        self.directory = tempfile.TemporaryDirectory(dir=test_root)
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.receipt_path = self.root / "receipts.jsonl"
        self.receipts = MODULE.Receipts(self.receipt_path, "test-context")
        self.source = FakeStorage({("wiki-media", KEY): object_record()})
        self.target = FakeStorage()

    def migrate(self):
        return MODULE.copy_version(self.source, self.target, "wiki-media", "aov-media-assets", row(), self.receipts)

    def write_manifest(self, rows):
        path = self.root / "manifest.json"
        path.write_text(json.dumps(rows), encoding="utf-8")
        return path

    def test_copy_preserves_key_identity_and_immutable_metadata(self):
        self.assertEqual(self.migrate(), "copied")
        self.assertEqual(self.target.puts, [{"Bucket": "aov-media-assets", "Key": KEY,
                                           "ContentLength": len(DATA), "ContentType": "image/png",
                                           "CacheControl": MODULE.CACHE_CONTROL,
                                           "Metadata": {"sha256": row()["sha256"]}, "IfNoneMatch": "*"}])
        receipt = json.loads(self.receipt_path.read_text())
        self.assertEqual(receipt["id"], VERSION_ID)
        self.assertEqual(receipt["sha256"], row()["sha256"])
        self.assertEqual(receipt["status"], "copied")
        self.assertEqual(self.source.puts, [])

    def test_resume_skips_upload_but_revalidates_current_destination(self):
        self.migrate()
        self.receipts = MODULE.Receipts(self.receipt_path, "test-context")
        self.assertIn(KEY, self.receipts.completed)
        self.assertEqual(self.migrate(), "verified_existing")
        self.assertEqual(len(self.target.puts), 1)
        self.assertEqual(len(self.target.reads), 2)

        self.target.objects["aov-media-assets", KEY] = object_record(b"x" * len(DATA))
        with self.assertRaises(MODULE.MigrationError):
            self.migrate()
        self.assertEqual(len(self.target.puts), 1)

    def test_source_corruption_prevents_upload_and_receipt(self):
        self.source.objects["wiki-media", KEY] = object_record(b"x" * len(DATA))
        with self.assertRaises(MODULE.MigrationError):
            self.migrate()
        self.assertEqual(self.target.puts, [])
        self.assertFalse(self.receipt_path.exists())

    def test_source_size_mismatch_prevents_upload(self):
        self.source.objects["wiki-media", KEY] = object_record(DATA + b"extra")
        with self.assertRaises(MODULE.MigrationError):
            self.migrate()
        self.assertEqual(self.target.puts, [])

    def test_existing_conflicting_immutable_target_is_never_overwritten(self):
        self.target.objects["aov-media-assets", KEY] = object_record(b"x" * len(DATA))
        with self.assertRaises(MODULE.MigrationError):
            self.migrate()
        self.assertEqual(self.target.puts, [])
        self.assertFalse(self.receipt_path.exists())

    def test_readback_corruption_leaves_no_success_receipt(self):
        self.target.corrupt_put = True
        with self.assertRaises(MODULE.MigrationError):
            self.migrate()
        self.assertFalse(self.receipt_path.exists())

    def test_existing_wrong_cache_metadata_is_not_silently_accepted(self):
        self.target.objects["aov-media-assets", KEY] = object_record(cache_control="private")
        with self.assertRaises(MODULE.MigrationError):
            self.migrate()
        self.assertEqual(self.target.puts, [])

    def test_permission_denied_is_not_treated_as_missing(self):
        self.target.head_error = ServiceError("AccessDenied", 403)
        with self.assertRaises(ServiceError):
            self.migrate()
        self.assertEqual(self.target.puts, [])

    def test_failure_diagnostics_include_status_without_exception_credentials(self):
        error = ServiceError("AccessDenied", 403)
        error.args = ("https://signed.example.com?credential=secret",)
        self.assertEqual(MODULE.safe_failure(error), {"errorType": "ServiceError", "storageCode": "AccessDenied",
                                                     "httpStatus": 403})
        self.assertNotIn("secret", json.dumps(MODULE.safe_failure(error)))

    def test_conditional_put_protects_a_racing_writer(self):
        self.target.racing_writer = True
        with self.assertRaises(ServiceError):
            self.migrate()
        self.assertEqual(self.target.puts[0]["IfNoneMatch"], "*")
        self.assertFalse(self.receipt_path.exists())

    def test_crashed_receipt_tail_is_repaired_only_on_append(self):
        self.migrate()
        with self.receipt_path.open("ab") as stream:
            stream.write(b'{"context":"test-context","object_key":')
        previous = self.receipt_path.read_bytes()
        self.receipts = MODULE.Receipts(self.receipt_path, "test-context")
        self.assertEqual(self.receipt_path.read_bytes(), previous)
        self.assertEqual(self.migrate(), "verified_existing")
        records = [json.loads(line) for line in self.receipt_path.read_text().splitlines()]
        self.assertEqual([record["status"] for record in records], ["copied", "verified_existing"])
        self.assertEqual(len(self.target.puts), 1)

    def test_corrupt_complete_receipt_and_wrong_context_are_rejected(self):
        self.receipt_path.write_text("invalid\n", encoding="utf-8")
        with self.assertRaises(MODULE.MigrationError):
            MODULE.Receipts(self.receipt_path, "test-context")
        self.receipt_path.write_text(json.dumps({"context": "other"}) + "\n", encoding="utf-8")
        with self.assertRaises(MODULE.MigrationError):
            MODULE.Receipts(self.receipt_path, "test-context")

    def test_manifest_rejects_identity_mismatch_duplicate_and_invalid_digest(self):
        self.assertEqual(MODULE.manifest_rows(self.write_manifest({"versions": [row()]})), [row()])
        invalid = row()
        invalid["object_key"] = KEY.replace(ASSET_ID, VERSION_ID)
        for rows in [[invalid], [row(), row()], [{**row(), "sha256": "not-a-checksum"}],
                     [{**row(), "storage_alias": "other"}], [{**row(), "size_bytes": True}]]:
            with self.subTest(rows=rows):
                with self.assertRaises(MODULE.MigrationError):
                    MODULE.manifest_rows(self.write_manifest(rows))

    def test_environment_is_literal_and_process_values_take_precedence(self):
        path = self.root / ".env.r2"
        path.write_text('STORAGE_ACCESS_KEY="$(do-not-execute)"\nSTORAGE_BUCKET=private # comment\n', encoding="utf-8")
        self.assertEqual(MODULE.read_environment(path, {"STORAGE_BUCKET": "process-private"}),
                         {"STORAGE_ACCESS_KEY": "$(do-not-execute)", "STORAGE_BUCKET": "process-private"})

    def test_remote_http_unexpected_endpoint_credentials_and_private_bucket_are_rejected(self):
        source, target, cdn = MODULE.configuration(settings(), None)
        self.assertEqual(target["bucket"], "aov-media-assets")
        self.assertEqual(source["endpoint"], "http://127.0.0.1:8333")
        self.assertEqual(cdn, "https://img.example.com/assets")
        cases = {"STORAGE_ENDPOINT": ["http://" + "a" * 32 + ".r2.cloudflarestorage.com",
                                      "https://evil.example.com", "https://u:p@" + "a" * 32 + ".r2.cloudflarestorage.com"],
                 "STORAGE_SECRET_KEY": ["REPLACE_LOCALLY", ""],
                 "SOURCE_STORAGE_ENDPOINT": ["http://remote.example.com", "https://127.0.0.1:8333"],
                 "STORAGE_ASSETS_BUCKET": ["aov-media-private"],
                 "MEDIA_PUBLIC_BASE_URL": ["https://u:p@img.example.com/assets", "http://img.example.com/assets",
                                            "https://img.example.com/incoming", "https://img.example.com/assets?x=y"]}
        for name, values in cases.items():
            for value in values:
                with self.subTest(name=name, value=value):
                    with self.assertRaises(MODULE.MigrationError):
                        MODULE.configuration({**settings(), name: value}, None)

    def test_context_changes_with_manifest_or_destination_but_not_credentials(self):
        source, target, cdn = MODULE.configuration(settings(), None)
        context = MODULE.migration_context([row()], source, target, cdn)
        self.assertEqual(context, MODULE.migration_context([row()], source, {**target, "secret_key": "rotated"}, cdn))
        self.assertNotEqual(context, MODULE.migration_context([row()], source, {**target, "bucket": "another-assets"}, cdn))

    def test_plan_does_not_create_clients_receipts_or_remote_objects(self):
        path = self.root / ".env.r2"
        path.write_text("\n".join(f"{key}={value}" for key, value in settings().items()), encoding="utf-8")
        with patch.dict(MODULE.os.environ, {}, clear=True), patch.object(MODULE, "create_client") as client:
            self.assertEqual(MODULE.main(["--manifest", str(self.write_manifest([row()])),
                                          "--environment-file", str(path), "--receipt", str(self.receipt_path)]), 0)
            client.assert_not_called()
        self.assertFalse(self.receipt_path.exists())

    def test_cdn_verifies_actual_bytes_cache_header_and_hit(self):
        opener = FakeOpener([Response(cache="MISS"), Response(), Response()])
        self.assertEqual(MODULE.verify_cdn(row(), "https://img.example.com/assets", opener), ["MISS", "HIT", "HIT"])
        self.assertEqual(opener.urls, ["https://img.example.com/" + KEY] * 3)
        self.assertTrue(all(request.get_header("User-agent") == "AthaHub-CDN-Verification/1.0"
                            and request.get_header("Accept-encoding") == "identity" for request in opener.requests))
        with self.assertRaises(MODULE.MigrationError):
            MODULE.verify_cdn(row(), "https://img.example.com/assets", FakeOpener([Response(b"x" * len(DATA))]))
        with self.assertRaises(MODULE.MigrationError):
            MODULE.verify_cdn(row(), "https://img.example.com/assets", FakeOpener([Response(cache="DYNAMIC") for _ in range(3)]))

    def test_cdn_refuses_redirects(self):
        with self.assertRaises(MODULE.MigrationError):
            MODULE.NoRedirect().redirect_request(None, None, 302, "redirect", {}, "https://other.example.com")

    def cdn_only_arguments(self, rows, completed):
        environment = self.root / ".env.r2"
        environment.write_text("\n".join(f"{key}={value}" for key, value in settings().items()), encoding="utf-8")
        source, target, cdn = MODULE.configuration(settings(), None)
        context = MODULE.migration_context(sorted(rows, key=lambda item: item["object_key"]), source, target, cdn)
        receipts = MODULE.Receipts(self.receipt_path, context)
        for item in completed:
            receipts.append(item, "copied")
        return ["--manifest", str(self.write_manifest(rows)), "--environment-file", str(environment),
                "--receipt", str(self.receipt_path), "--verify-cdn-only"]

    def test_cdn_only_requires_every_manifest_receipt_before_any_cdn_or_s3_calls(self):
        second = {**row(), "id": "1bf2190f-354d-4624-8e25-bba5bcdd649b",
                  "object_key": f"assets/{ASSET_ID}/1bf2190f-354d-4624-8e25-bba5bcdd649b.png"}
        args = self.cdn_only_arguments([row(), second], [row()])
        before = self.receipt_path.read_bytes()
        with patch.dict(MODULE.os.environ, {}, clear=True), patch.object(MODULE, "create_client") as client, \
                patch.object(MODULE, "verify_cdn") as cdn:
            with self.assertRaisesRegex(MODULE.MigrationError, "every manifest object"):
                MODULE.main(args)
        client.assert_not_called()
        cdn.assert_not_called()
        self.assertEqual(self.receipt_path.read_bytes(), before)

    def test_cdn_only_uses_complete_matching_receipts_without_s3_or_receipt_writes(self):
        args = self.cdn_only_arguments([row()], [row()])
        before = self.receipt_path.read_bytes()
        with patch.dict(MODULE.os.environ, {}, clear=True), patch.object(MODULE, "create_client") as client, \
                patch.object(MODULE, "ThreadPoolExecutor") as executor, \
                patch.object(MODULE, "verify_cdn", return_value=["MISS", "HIT", "HIT"]) as cdn:
            self.assertEqual(MODULE.main(args), 0)
        client.assert_not_called()
        executor.assert_not_called()
        cdn.assert_called_once_with(row(), "https://img.example.com/assets")
        self.assertEqual(self.receipt_path.read_bytes(), before)

    def test_cdn_only_cannot_skip_cdn_or_combine_with_apply(self):
        args = self.cdn_only_arguments([row()], [row()])
        with patch.dict(MODULE.os.environ, {}, clear=True), patch.object(MODULE, "create_client") as client:
            with self.assertRaisesRegex(MODULE.MigrationError, "requires sample or all"):
                MODULE.main([*args, "--cdn-verify", "none"])
        client.assert_not_called()
        with patch("sys.stderr", io.StringIO()), self.assertRaises(SystemExit):
            MODULE.parser().parse_args([*args, "--apply"])

    def test_sample_covers_first_and_last_and_all_when_small(self):
        self.assertEqual(MODULE.sample_rows(list(range(100)), 3), [0, 49, 99])
        self.assertEqual(MODULE.sample_rows([1, 2], 10), [1, 2])


if __name__ == "__main__":
    unittest.main()
