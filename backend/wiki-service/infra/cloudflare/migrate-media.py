"""Copy immutable Media objects to R2 without changing database identities or keys."""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import threading
from urllib.parse import quote, urlsplit
from urllib.request import build_opener, HTTPRedirectHandler, Request
import uuid


CACHE_CONTROL = "public, max-age=31536000, immutable"
CDN_USER_AGENT = "AthaHub-CDN-Verification/1.0"
LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}
ALLOWED_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}
SERVICE_ROOT = Path(__file__).resolve().parents[2]
ENVIRONMENT_NAME = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
ASSET_KEY = re.compile(r"assets/([0-9a-f-]{36})/([0-9a-f-]{36})\.(png|jpg|webp)")
SHA256 = re.compile(r"[0-9a-f]{64}")


class MigrationError(Exception):
    """A migration invariant failed; do not switch the active application storage."""


def read_environment(path, process_values=None):
    values = {}
    if path is not None:
        for number, line in enumerate(Path(path).read_text(encoding="utf-8-sig").splitlines(), 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            if line.startswith("export "):
                line = line[7:].lstrip()
            name, separator, value = line.partition("=")
            name, value = name.strip(), value.strip()
            if not separator or not ENVIRONMENT_NAME.fullmatch(name) or name in values:
                raise MigrationError(f"Invalid or duplicate environment assignment at line {number}.")

            if value.startswith(("'", '"')):
                if len(value) < 2 or not value.endswith(value[0]):
                    raise MigrationError(f"Unterminated environment value at line {number}.")
                value = value[1:-1]
            else:
                value = re.split(r"\s+#", value, maxsplit=1)[0].rstrip()
            if "\x00" in value:
                raise MigrationError(f"Invalid environment value at line {number}.")
            values[name] = value

    # Literal data only; no shell evaluation, interpolation or credential logging.
    values.update(os.environ if process_values is None else process_values)
    return values


def required(values, name):
    value = values.get(name, "").strip()
    if not value or any(marker in value.upper() for marker in ("REPLACE_", "CHANGEME", "YOUR_", "<", ">")):
        raise MigrationError(f"Set a real local value for {name} before continuing.")
    return value


def endpoint(value, *, target):
    parsed = urlsplit(value)
    if (not parsed.hostname or parsed.username is not None or parsed.password is not None
            or parsed.query or parsed.fragment or parsed.path not in ("", "/")):
        raise MigrationError("Storage endpoint must contain only a trusted scheme, host and optional local port.")

    if target:
        if (parsed.scheme != "https" or parsed.port not in (None, 443)
                or not re.fullmatch(r"[0-9a-f]{32}\.r2\.cloudflarestorage\.com", parsed.hostname)):
            raise MigrationError("Target storage must be an HTTPS Cloudflare R2 account endpoint.")
    elif parsed.scheme != "http" or parsed.hostname not in LOOPBACK_HOSTS:
        raise MigrationError("Source storage must be an HTTP loopback endpoint.")
    return value.rstrip("/")


def public_base_url(value):
    parsed = urlsplit(value)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.hostname in LOOPBACK_HOSTS
            or parsed.username is not None or parsed.password is not None or parsed.port not in (None, 443)
            or parsed.query or parsed.fragment or parsed.path.rstrip("/") != "/assets"):
        raise MigrationError("Public CDN base URL must be HTTPS on an image hostname with the /assets prefix.")
    return value.rstrip("/")


def bucket_name(value):
    if (not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,61}[a-z0-9]", value)
            or re.fullmatch(r"\d+\.\d+\.\d+\.\d+", value)):
        raise MigrationError("Invalid storage bucket name.")
    return value


def configuration(values, source_credentials_file):
    destination = {
        "endpoint": endpoint(required(values, "STORAGE_ENDPOINT"), target=True),
        "region": values.get("STORAGE_REGION", "auto"),
        "bucket": bucket_name(required(values, "STORAGE_ASSETS_BUCKET")),
        "access_key": required(values, "STORAGE_ACCESS_KEY"),
        "secret_key": required(values, "STORAGE_SECRET_KEY"),
    }
    if destination["region"] not in ("auto", "us-east-1"):
        raise MigrationError("R2 signing region must be auto or us-east-1.")
    private_bucket = bucket_name(required(values, "STORAGE_BUCKET"))
    if destination["bucket"] == private_bucket:
        raise MigrationError("R2 public assets and private staging must use separate buckets.")

    source = {
        "endpoint": endpoint(values.get("SOURCE_STORAGE_ENDPOINT", "http://127.0.0.1:8333"), target=False),
        "region": values.get("SOURCE_STORAGE_REGION", "us-east-1"),
        "bucket": bucket_name(values.get("SOURCE_STORAGE_BUCKET", "wiki-media")),
    }
    if values.get("SOURCE_STORAGE_ACCESS_KEY") or values.get("SOURCE_STORAGE_SECRET_KEY"):
        source["access_key"] = required(values, "SOURCE_STORAGE_ACCESS_KEY")
        source["secret_key"] = required(values, "SOURCE_STORAGE_SECRET_KEY")
    else:
        source_config = json.loads(Path(source_credentials_file).read_text(encoding="utf-8-sig"))
        credentials = [item for identity in source_config.get("identities", [])
                       for item in identity.get("credentials", [])]
        if len(credentials) != 1:
            raise MigrationError("Choose SOURCE_STORAGE_ACCESS_KEY and SOURCE_STORAGE_SECRET_KEY explicitly.")
        source["access_key"] = required({"key": credentials[0].get("accessKey", "")}, "key")
        source["secret_key"] = required({"key": credentials[0].get("secretKey", "")}, "key")

    return source, destination, public_base_url(required(values, "MEDIA_PUBLIC_BASE_URL"))


def manifest_rows(path):
    content = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    rows = content.get("versions") if isinstance(content, dict) else content
    if not isinstance(rows, list) or not rows:
        raise MigrationError("Manifest must be a nonempty array or an object with a versions array.")

    ids, keys = set(), set()
    result = []
    for row in rows:
        if not isinstance(row, dict):
            raise MigrationError("Manifest versions must be objects.")
        fields = ("id", "asset_id", "object_key", "sha256", "mime_type", "size_bytes", "storage_alias")
        if any(name not in row for name in fields):
            raise MigrationError("Manifest version is missing required identity or integrity fields.")

        version_id, asset_id = str(row["id"]), str(row["asset_id"])
        try:
            if str(uuid.UUID(version_id)) != version_id or str(uuid.UUID(asset_id)) != asset_id:
                raise ValueError()
        except (ValueError, TypeError):
            raise MigrationError("Manifest must contain canonical UUIDs.") from None

        key = row["object_key"]
        key_match = ASSET_KEY.fullmatch(key) if isinstance(key, str) else None
        mime_type = row["mime_type"]
        if (not key_match or key_match.group(1) != asset_id or key_match.group(2) != version_id
                or mime_type not in ALLOWED_TYPES or not key.endswith(ALLOWED_TYPES[mime_type])):
            raise MigrationError("Manifest immutable asset key does not match its identity or content type.")
        if (row["storage_alias"] != "primary" or not isinstance(row["sha256"], str)
                or not SHA256.fullmatch(row["sha256"]) or isinstance(row["size_bytes"], bool)
                or not isinstance(row["size_bytes"], int) or row["size_bytes"] <= 0):
            raise MigrationError("Manifest version has invalid storage alias, SHA-256 or byte size.")
        if version_id in ids or key in keys:
            raise MigrationError("Manifest contains duplicate versions or immutable object keys.")

        ids.add(version_id)
        keys.add(key)
        result.append({name: row[name] for name in fields})
    return sorted(result, key=lambda row: row["object_key"])


def canonical_hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def migration_context(rows, source, destination, cdn):
    safe_source = {name: source[name] for name in ("endpoint", "bucket", "region")}
    safe_destination = {name: destination[name] for name in ("endpoint", "bucket", "region")}
    return canonical_hash({"manifest": rows, "source": safe_source, "target": safe_destination, "cdn": cdn})


class Receipts:
    def __init__(self, path, context):
        self.path = Path(path)
        self.context = context
        self.completed = set()
        self.lock = threading.Lock()
        self.tail_repair = None

        if self.path.exists():
            data = self.path.read_bytes()
            lines = data.splitlines(keepends=True)
            for index, raw in enumerate(lines):
                try:
                    record = json.loads(raw)
                except (ValueError, UnicodeDecodeError):
                    if index == len(lines) - 1 and not raw.endswith(b"\n"):
                        # A crashed final append is untrusted and will be checked again.
                        self.tail_repair = len(data) - len(raw)
                        continue
                    raise MigrationError("Receipt contains corrupt complete lines; preserve it and use a new receipt.") from None
                if record.get("context") != context:
                    raise MigrationError("Receipt belongs to a different manifest or storage destination.")
                if record.get("status") in ("copied", "verified_existing"):
                    self.completed.add(record["object_key"])
            if data and not data.endswith(b"\n") and self.tail_repair is None:
                self.tail_repair = -1

    def append(self, row, status):
        record = {"context": self.context, "object_key": row["object_key"], "id": row["id"],
                  "sha256": row["sha256"], "size_bytes": row["size_bytes"], "status": status,
                  "verified_at": datetime.now(timezone.utc).isoformat()}
        encoded = (json.dumps(record, sort_keys=True) + "\n").encode()
        with self.lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            if self.tail_repair is not None:
                # Truncate only a partial crashed tail, never a complete receipt entry.
                with self.path.open("rb+") as existing:
                    if self.tail_repair >= 0:
                        existing.truncate(self.tail_repair)
                    else:
                        existing.seek(0, 2)
                        existing.write(b"\n")
                self.tail_repair = None
            with self.path.open("ab") as output:
                output.write(encoded)
                output.flush()
                os.fsync(output.fileno())
            self.completed.add(row["object_key"])


def missing_object(error):
    response = getattr(error, "response", {})
    code = str(response.get("Error", {}).get("Code", ""))
    status = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
    return code in ("404", "NoSuchKey", "NotFound") or status == 404


def safe_failure(error):
    result = {"errorType": type(error).__name__}
    if isinstance(error, MigrationError):
        result["reason"] = str(error)
    else:
        response = getattr(error, "response", {})
        code = str(response.get("Error", {}).get("Code", ""))
        status = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        if re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", code):
            result["storageCode"] = code
        if isinstance(status, int):
            result["httpStatus"] = status
    return result


def verify_bytes(body, row, output=None):
    digest, count = hashlib.sha256(), 0
    with closing(body):
        while True:
            chunk = body.read(1024 * 1024)
            if not chunk:
                break
            count += len(chunk)
            if count > row["size_bytes"]:
                raise MigrationError(f"Object exceeds the manifest size: {row['object_key']}")
            digest.update(chunk)
            if output is not None:
                output.write(chunk)
    if count != row["size_bytes"] or digest.hexdigest() != row["sha256"]:
        raise MigrationError(f"Object checksum or size differs from the database: {row['object_key']}")


def verify_destination(client, bucket, row):
    response = client.get_object(Bucket=bucket, Key=row["object_key"])
    try:
        if (response.get("ContentLength") != row["size_bytes"] or response.get("ContentType") != row["mime_type"]
                or response.get("CacheControl") != CACHE_CONTROL):
            raise MigrationError(f"Destination metadata differs from the immutable contract: {row['object_key']}")
        verify_bytes(response["Body"], row)
    finally:
        response["Body"].close()


def copy_version(source_client, destination_client, source_bucket, destination_bucket, row, receipts):
    # Receipts are evidence, never authority: every rerun revalidates current bytes.
    source = source_client.get_object(Bucket=source_bucket, Key=row["object_key"])
    receipts.path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryFile(mode="w+b", dir=receipts.path.parent) as local:
        verify_bytes(source["Body"], row, local)
        local.seek(0)

        try:
            destination_client.head_object(Bucket=destination_bucket, Key=row["object_key"])
            exists = True
        except Exception as error:
            if not missing_object(error):
                raise
            exists = False

        status = "verified_existing"
        if not exists:
            # Conditional creation also protects against another writer racing this migration.
            destination_client.put_object(Bucket=destination_bucket, Key=row["object_key"], Body=local,
                                          ContentLength=row["size_bytes"], ContentType=row["mime_type"],
                                          CacheControl=CACHE_CONTROL, Metadata={"sha256": row["sha256"]},
                                          IfNoneMatch="*")
            status = "copied"

        verify_destination(destination_client, destination_bucket, row)
    receipts.append(row, status)
    return status


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise MigrationError("CDN verification refuses redirects to a different location.")


def verify_cdn(row, base_url, opener=None):
    url = base_url + "/" + quote(row["object_key"][len("assets/"):], safe="/")
    opener = opener or build_opener(NoRedirect())
    states = []
    for _ in range(3):
        with opener.open(Request(url, headers={"Accept-Encoding": "identity", "User-Agent": CDN_USER_AGENT}), timeout=60) as response:
            if response.status != 200 or response.headers.get("Content-Type", "").split(";")[0] != row["mime_type"]:
                raise MigrationError(f"CDN response does not match its media type: {row['object_key']}")
            if response.headers.get("Cache-Control") != CACHE_CONTROL:
                raise MigrationError(f"CDN does not preserve immutable cache headers: {row['object_key']}")
            verify_bytes(response, row)
            states.append(response.headers.get("CF-Cache-Status", "missing"))
    if "HIT" not in states:
        raise MigrationError(f"CDN did not report a cache HIT: {row['object_key']}")
    return states


def sample_rows(rows, count):
    if count >= len(rows):
        return rows
    if count == 1:
        return rows[:1]
    return [rows[index * (len(rows) - 1) // (count - 1)] for index in range(count)]


def verify_cdn_rows(rows, base_url, mode, sample_size):
    if mode == "none":
        return 0
    checked = rows if mode == "all" else sample_rows(rows, sample_size)
    for row in checked:
        states = verify_cdn(row, base_url)
        print(json.dumps({"cdnVerifiedKey": row["object_key"], "cacheStates": states}), flush=True)
    return len(checked)


def create_client(settings):
    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        raise MigrationError("Install the offline tool dependencies from requirements.txt in a local virtual environment.") from None

    return boto3.client("s3", endpoint_url=settings["endpoint"], region_name=settings["region"],
                        aws_access_key_id=settings["access_key"], aws_secret_access_key=settings["secret_key"],
                        config=Config(signature_version="s3v4", retries={"mode": "standard", "max_attempts": 4},
                                      max_pool_connections=8, connect_timeout=15, read_timeout=90,
                                      request_checksum_calculation="when_required",
                                      response_checksum_validation="when_required",
                                      s3={"addressing_style": "path", "payload_signing_enabled": False}))


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--manifest", required=True, type=Path)
    result.add_argument("--environment-file", type=Path, default=SERVICE_ROOT / ".env.r2")
    result.add_argument("--source-credentials-file", type=Path,
                        default=SERVICE_ROOT / "infra/local/seaweedfs/s3.json")
    result.add_argument("--receipt", required=True, type=Path)
    result.add_argument("--workers", type=int, choices=range(1, 9), default=3)
    action = result.add_mutually_exclusive_group()
    action.add_argument("--plan", action="store_true", help="Validate configuration and report the immutable copy plan (default).")
    action.add_argument("--apply", action="store_true", help="Copy and verify objects; never mutate the database or delete the source.")
    action.add_argument("--verify-cdn-only", action="store_true",
                        help="Check CDN delivery using a fully completed migration receipt; never open S3 clients or write objects.")
    result.add_argument("--cdn-verify", choices=("sample", "all", "none"), default="sample")
    result.add_argument("--cdn-sample-size", type=int, default=10)
    return result


def main(argv=None):
    args = parser().parse_args(argv)
    if args.cdn_sample_size < 1:
        raise MigrationError("CDN sample size must be positive.")
    rows = manifest_rows(args.manifest)
    values = read_environment(args.environment_file)
    source, target, cdn = configuration(values, args.source_credentials_file)
    context = migration_context(rows, source, target, cdn)
    receipts = Receipts(args.receipt, context)
    mode = "cdn-only" if args.verify_cdn_only else "apply" if args.apply else "plan"
    print(json.dumps({"mode": mode, "versions": len(rows),
                      "bytes": sum(row["size_bytes"] for row in rows), "sourceBucket": source["bucket"],
                      "targetBucket": target["bucket"], "cdn": cdn, "priorReceipts": len(receipts.completed),
                      "context": context, "databaseMutations": False, "sourceDeletions": False}), flush=True)
    if args.verify_cdn_only:
        if args.cdn_verify == "none":
            raise MigrationError("CDN-only mode requires sample or all CDN verification.")
        if not {row["object_key"] for row in rows}.issubset(receipts.completed):
            raise MigrationError("CDN-only verification requires completed receipts for every manifest object.")

        checked = verify_cdn_rows(rows, cdn, args.cdn_verify, args.cdn_sample_size)
        print(json.dumps({"status": "cdn_verified", "versions": len(rows), "cdnVerified": checked,
                          "objectWrites": False, "receiptWrites": False}), flush=True)
        return 0
    if not args.apply:
        return 0

    source_client, target_client = create_client(source), create_client(target)
    counts = {"copied": 0, "verified_existing": 0}
    failures = []
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        tasks = {executor.submit(copy_version, source_client, target_client, source["bucket"], target["bucket"],
                                 row, receipts): row for row in rows}
        for number, future in enumerate(as_completed(tasks), 1):
            try:
                counts[future.result()] += 1
            except Exception as error:
                failures.append(tasks[future]["object_key"])
                # SDK messages may contain signed URLs or credential details; never print them.
                print(json.dumps({"failedKey": tasks[future]["object_key"], **safe_failure(error)}), flush=True)
            if number % 100 == 0 or number == len(rows):
                print(json.dumps({"checked": number, "total": len(rows), **counts, "failed": len(failures)}), flush=True)
    if failures:
        raise MigrationError(f"{len(failures)} objects failed verification. Keep the current storage and rerun after resolving failures.")

    checked = verify_cdn_rows(rows, cdn, args.cdn_verify, args.cdn_sample_size)
    print(json.dumps({"status": "verified", **counts, "versions": len(rows),
                      "cdnVerified": checked}), flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except MigrationError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception as error:
        print(f"Migration stopped ({type(error).__name__}); no database or source changes were made.", file=sys.stderr)
        sys.exit(1)
