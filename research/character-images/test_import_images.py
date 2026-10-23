"""Exercise candidate preservation without calling a live API or modifying resources."""

import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch


spec = importlib.util.spec_from_file_location("character_images", Path(__file__).with_name("import-images.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
rename_spec = importlib.util.spec_from_file_location("canonical_identifiers", Path(__file__).with_name("rename-identifiers.py"))
rename = importlib.util.module_from_spec(rename_spec)
rename_spec.loader.exec_module(rename)


class ImageImportTest(unittest.TestCase):
    def test_upload_hosts_require_explicit_exact_https_authorization(self):
        host = "account.r2.cloudflarestorage.com"
        remote = "https://" + host + "/private/incoming/image.png?X-Amz-Signature=keep-exact"
        for url in ["http://localhost:8333/bucket/incoming/image.png", "http://127.0.0.1:8333/incoming/x",
                    "http://[::1]:8333/incoming/x"]:
            self.assertEqual(module.validate_upload_url(url), url)
        with self.assertRaises(ValueError):
            module.validate_upload_url(remote)
        self.assertEqual(module.validate_upload_url(remote, [host]), remote)

        invalid = [remote.replace("https:", "http:"), remote.replace(host, host + ".evil.example"),
                   remote.replace(host, "sub." + host), remote.replace(host, "user@" + host),
                   remote.replace(host, ":password@" + host), remote.replace(host, host + ":443"),
                   remote.replace(host, host + ":8443"), remote.replace(host, host + ":"), remote + "#fragment", remote + "#",
                   remote.replace("/private", "\\private"), remote + "\n", "file:///incoming/image.png",
                   "http://user@localhost:8333/incoming/x", "http://localhost:invalid/incoming/x"]
        for url in invalid:
            with self.subTest(url=url), self.assertRaises(ValueError):
                module.validate_upload_url(url, [host])

    def test_host_option_rejects_wildcards_urls_paths_and_ports(self):
        self.assertEqual(module.upload_host("ACCOUNT.r2.cloudflarestorage.com"), "account.r2.cloudflarestorage.com")
        for host in ["https://storage.example.com", "*.example.com", "storage.example.com:443", "user@storage.example.com",
                     "storage.example.com/path", "example.com.", "storage..example.com", "-storage.example.com"]:
            with self.subTest(host=host), self.assertRaises(module.argparse.ArgumentTypeError):
                module.upload_host(host)

    def test_upload_preserves_signed_url_headers_and_bytes_without_following_redirects(self):
        host = "account.r2.cloudflarestorage.com"
        ticket = {"uploadUrl": "https://" + host + "/bucket/incoming/x?X-Amz-Signature=original",
                  "method": "PUT", "headers": {"Content-Type": "image/png", "Host": host}}
        response = Mock()
        response.status = 200
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        with patch.object(module, "upload_urlopen", return_value=response) as send:
            module.upload_ticket(ticket, b"image-bytes", [host])
        request = send.call_args.args[0]
        self.assertEqual(request.full_url, ticket["uploadUrl"])
        self.assertEqual(request.data, b"image-bytes")
        self.assertEqual(request.get_header("Content-type"), "image/png")
        self.assertEqual(request.get_header("Host"), host)
        self.assertEqual(request.get_method(), "PUT")
        self.assertTrue(any(isinstance(handler, module.NoUploadRedirect)
                            for handler in module.upload_urlopen.__self__.handlers))
        for code in [301, 302, 303, 307, 308]:
            with self.subTest(code=code), self.assertRaises(ValueError):
                module.NoUploadRedirect().redirect_request(request, None, code, "redirect", {}, "http://unexpected.example.com")

    def test_unauthorized_ticket_never_sends_bytes(self):
        ticket = {"uploadUrl": "https://unexpected.example.com/incoming/x", "method": "PUT", "headers": {}}
        with patch.object(module, "upload_urlopen") as send:
            with self.assertRaises(ValueError):
                module.upload_ticket(ticket, b"private-image")
            with self.assertRaises(ValueError):
                module.upload_ticket({**ticket, "uploadUrl": "http://localhost:8333/x", "method": "POST"}, b"image")
        send.assert_not_called()

    def test_character_import_passes_allowlist_to_shared_upload(self):
        importer = module.Importer.__new__(module.Importer)
        importer.args = SimpleNamespace(upload_host=["account.r2.cloudflarestorage.com"])
        importer.state = {"assets": {}}
        importer.state_lock = module.threading.RLock()
        importer.uploaded = importer.reused = 0
        importer.checkpoint = Mock()
        importer.matching_asset = Mock(return_value=None)
        importer.api = Mock()
        ticket = {"uploadId": "upload", "uploadUrl": "https://account.r2.cloudflarestorage.com/private/x",
                  "method": "PUT", "headers": {}}
        importer.api.call.side_effect = [{"id": "asset"}, ticket, {"current": True}]
        file = Mock(name="source-file")
        file.name = "test.png"
        file.read_bytes.return_value = b"image"
        with patch.object(module, "local_file", return_value=file), patch.object(module, "upload_ticket") as upload:
            self.assertEqual(importer.upload_one("assets/test.png", "HERO_HEAD"), "asset")
        upload.assert_called_once_with(ticket, b"image", importer.args.upload_host)

    def test_character_cli_wires_repeatable_upload_hosts(self):
        with patch.object(module.sys, "argv", ["import-images.py", "--upload-host", "a.example.com",
                                               "--upload-host", "b.example.com"]), patch.object(module, "Importer") as importer:
            module.main()
        self.assertEqual(importer.call_args.args[0].upload_host, ["a.example.com", "b.example.com"])

    def test_badge_names_retain_source_rank_prefix_only_where_present(self):
        self.assertEqual(rename.badge_name("bac-s-plus-mau-02"), "Bậc S+")
        self.assertEqual(rename.badge_name("bac-ss-mau-01"), "Bậc SS")
        self.assertEqual(rename.badge_name("ss-huu-han-mau-02"), "SS Hữu hạn")
        self.assertEqual(rename.badge_name("attack-on-titan"), "Attack On Titan")
        self.assertEqual(rename.badge_name("s3-thuong-hang-2026"), "S3 Thưởng hạng 2026")
        self.assertEqual(rename.badge_name("thuong-hang-2026"), "Thưởng hạng 2026")

    def test_alternates_are_distinct_and_import_is_idempotent(self):
        importer = module.Importer.__new__(module.Importer)
        calls = []

        def upload(path, semantic, known):
            calls.append((path, semantic))
            return semantic + ":" + path

        importer.upload = upload
        original = "existing-main"
        target = {"bindings": {"PORTRAIT": original}, "sources": [{"label": "Keep"}]}
        source = {"portrait": "assets/skin/main.png", "portraitAlternates": ["assets/skin/main-1.png", "assets/skin/main-2.png"]}
        importer.fill_images(target, source, True)
        self.assertEqual(target["bindings"]["PORTRAIT"], original)
        self.assertEqual([item["label"] for item in target["images"]["PORTRAIT"]], [None, "main.png", "main-1.png", "main-2.png"])
        self.assertEqual(target["sources"], [{"label": "Keep"}])
        first = module.copy.deepcopy(target)
        importer.fill_images(target, source, True)
        self.assertEqual(target, first)
        self.assertTrue(all(semantic == "HERO_PORTRAIT" for _, semantic in calls))

    def test_skin_roles_keep_existing_mains_and_localized_fields(self):
        importer = module.Importer.__new__(module.Importer)
        importer.upload = lambda path, semantic, known: semantic + ":" + path
        target = {"artAssetId": "old-cover", "translations": [{"locale": "en-US", "name": "Existing"}]}
        source = {"head": "assets/head.png", "portrait": "assets/portrait.png", "cover": "assets/cover.jpg"}
        importer.fill_images(target, source)
        self.assertEqual(target["artAssetId"], "old-cover")
        self.assertEqual(target["headAssetId"], "HERO_SKIN_ART:assets/head.png")
        self.assertEqual(target["portraitAssetId"], "HERO_SKIN_ART:assets/portrait.png")
        self.assertEqual(target["images"]["SPLASH"][0]["assetId"], "old-cover")
        self.assertEqual(target["translations"], [{"locale": "en-US", "name": "Existing"}])

    def test_paths_keep_exact_source_names_and_reject_package_escape(self):
        self.assertEqual(module.paths({"head": "assets/head.png", "listHead": "assets/list.png"}, "HEAD", True), ["assets/head.png", "assets/list.png"])
        with self.assertRaises(ValueError):
            module.local_file("assets/../../outside.jpg")
        with self.assertRaises(ValueError):
            module.local_file("C:/outside.jpg")

    def test_numbered_variant_folders_have_distinct_labels_and_gif_stays_explicitly_unsupported(self):
        self.assertEqual(module.image_label("assets/skin/portrait/hero.png"), "hero.png")
        self.assertEqual(module.image_label("assets/skin/portrait/variants/01/hero.png"), "hero-1.png")
        self.assertEqual(module.image_label("assets/skin/portrait/variants/02/hero.png"), "hero-2.png")
        self.assertFalse(module.supported("assets/hero.gif"))
        self.assertTrue(module.supported("assets/hero.png"))

    def test_missing_short_name_uses_supplied_full_name_or_visible_stable_code(self):
        self.assertEqual(module.skin_name({"id": "thane-heroskin-2", "name": "", "fullName": "Thane"}), "Thane")
        self.assertEqual(module.skin_name({"id": "unknown-skin", "name": "  "}), "unknown-skin")

    def test_checkpoint_replace_retries_temporary_windows_read_locks(self):
        with patch.object(Path, "mkdir"), patch.object(Path, "write_text"), patch.object(Path, "replace", side_effect=[PermissionError("locked"), None]) as replace, patch.object(module.time, "sleep") as sleep:
            module.write(Path("checkpoint.json"), {"assets": {}})
            self.assertEqual(replace.call_count, 2)
            sleep.assert_called_once()


if __name__ == "__main__":
    unittest.main()
