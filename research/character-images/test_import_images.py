"""Exercise candidate preservation without calling a live API or modifying resources."""

import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("character_images", Path(__file__).with_name("import-images.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
rename_spec = importlib.util.spec_from_file_location("canonical_identifiers", Path(__file__).with_name("rename-identifiers.py"))
rename = importlib.util.module_from_spec(rename_spec)
rename_spec.loader.exec_module(rename)


class ImageImportTest(unittest.TestCase):
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
