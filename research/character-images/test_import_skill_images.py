"""Verify skill-source safety and preservation without a running app."""

import importlib.util
from pathlib import Path
import tempfile
import unittest
import json
import hashlib
from types import SimpleNamespace
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("skill_images", Path(__file__).with_name("import-skill-images.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SkillImageImportTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        module.STATE.parent.mkdir(parents=True, exist_ok=True)

    def package(self, root, rows):
        (root / "data").mkdir()
        (root / "assets/skill").mkdir(parents=True)
        (root / "assets/skill/test.png").write_bytes(b"image")
        (root / "data/nguon-icon-chieu.json").write_text(json.dumps(rows), encoding="utf-8")

    def row(self):
        return {"status": "ok", "heroId": "test", "slot": 4, "variant": 3,
                "file": "assets/skill/test.png", "sha256": hashlib.sha256(b"image").hexdigest()}

    def test_skill_import_uses_the_shared_upload_allowlist(self):
        importer = module.Importer.__new__(module.Importer)
        importer.args = SimpleNamespace(upload_host=["account.r2.cloudflarestorage.com"])
        importer.lock = module.threading.RLock()
        importer.hash_locks, importer.hash_assets = {}, {}
        importer.state = {"assets": {}}
        importer.uploaded = importer.reused = 0
        importer.checkpoint = Mock()
        importer.api = Mock()
        ticket = {"uploadId": "upload", "uploadUrl": "https://account.r2.cloudflarestorage.com/private/x",
                  "method": "PUT", "headers": {}}
        importer.api.call.side_effect = [{"id": "asset"}, ticket, {"current": True}]
        file = Mock(name="source-file")
        file.name = "test.png"
        file.read_bytes.return_value = b"image"
        source = {**self.row(), "path": file}
        with patch.object(module.helpers, "upload_ticket") as upload:
            self.assertEqual(importer.upload(source), "asset")
        upload.assert_called_once_with(ticket, b"image", importer.args.upload_host)

    def test_skill_cli_passes_upload_hosts_and_retains_loopback_api(self):
        with patch.object(module.sys, "argv", ["import-skill-images.py", "--upload-host", "a.example.com",
                                               "--upload-host", "b.example.com"]), patch.object(module, "Importer") as importer:
            module.main()
        args = importer.call_args.args[0]
        self.assertEqual(args.upload_host, ["a.example.com", "b.example.com"])
        self.assertEqual(args.backend, "http://localhost:8080")

    def test_keeps_uncollected_skill_slots_and_all_variants(self):
        with tempfile.TemporaryDirectory(dir=module.STATE.parent) as directory:
            root = Path(directory)
            self.package(root, [self.row()])
            rows = module.sources(root)
            self.assertEqual((rows[0]["slot"], rows[0]["variant"]), (4, 3))
            self.assertNotIn("description", rows[0])

    def test_rejects_duplicate_slot_variant_changed_bytes_and_unsafe_paths(self):
        for modifier in [lambda row: [row, row], lambda row: [{**row, "sha256": "wrong"}],
                         lambda row: [{**row, "file": "../test.png"}]]:
            with self.subTest(modifier=modifier), tempfile.TemporaryDirectory(dir=module.STATE.parent) as directory:
                root = Path(directory)
                self.package(root, modifier(self.row()))
                with self.assertRaises(ValueError):
                    module.sources(root)

    def test_only_verified_codes_resolve_and_missing_heroes_are_not_invented(self):
        row = self.row()
        hero = {"id": "existing"}
        self.assertEqual(module.source_identity(row, {"canonical": hero}, {"test": "canonical"}), hero)
        self.assertIsNone(module.source_identity(row, {}, {}))


if __name__ == "__main__":
    unittest.main()
