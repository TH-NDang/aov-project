"""Check source fidelity, relationship resolution, and safe resumability without a live backend."""

import argparse
import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import Mock, patch


spec = importlib.util.spec_from_file_location("warehouse_import", Path(__file__).with_name("import-warehouse.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class WarehouseImportTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan = module.load_plan()

    def row(self, kind, code):
        return next(row for row in self.plan["rows"] if row["kind"] == kind and row["code"] == code)

    def test_all_mapped_source_images_exist_and_baseline_has_no_patch_attribution(self):
        self.assertEqual(self.plan["summary"]["records"], {"items": 112, "enchantments": 31, "arcana": 88, "spells": 14})
        self.assertEqual(len(self.plan["media"]), 255)
        self.assertEqual(self.plan["summary"]["verifiedRecipeEdges"], 192)
        self.assertTrue(all("effectiveFromPatchVariantId" not in row["content"] for row in self.plan["rows"]))
        for row in self.plan["rows"]:
            note = module.json.loads(row["content"]["notes"])
            self.assertTrue(note["baseline"])
            self.assertEqual(note["source"], row["source"])
            self.assertEqual(row["content"]["translations"][0]["locale"], "vi-VN")

    def test_unknown_recipes_and_missing_arcana_attributes_stay_unknown(self):
        for code in ["xa-nhat-cung", "thuong-khung-kiem"]:
            content = self.row("items", code)["content"]
            self.assertEqual(content["recipeStatus"], "UNKNOWN")
            self.assertEqual(content["components"], [])
        for code in ["xanh-1-giap-phep", "xanh-1-mau-hoi-chieu"]:
            content = self.row("arcana", code)["content"]
            self.assertEqual(content["stats"], [])
            self.assertIsNone(content["translations"][0]["description"])

    def test_item_shop_variant_labels_are_localized_without_losing_position(self):
        row = self.row("items", "dai-dia-than-khien")
        position = row["content"]["shopPositions"][0]
        self.assertEqual(position, {"categoryCode": "phu-tro", "row": 0, "column": 2, "variant": "earth"})
        self.assertEqual(row["content"]["translations"][0]["variantLabels"], {"earth": "Đại địa"})

    def test_spell_charge_states_and_reference_images_remain_distinct(self):
        row = self.row("spells", "trung-tri")
        content = row["content"]
        self.assertEqual((content["cooldownSeconds"], content["chargeRechargeSeconds"], content["maxCharges"]), (10, 45, 2))
        self.assertEqual([state["key"] for state in content["states"]], ["thuong", "te-tai"])
        self.assertTrue(all(state["translations"][0]["description"] is None for state in content["states"]))
        ids = {image["semantic"] + ":" + image["path"]: "asset-" + str(index) for index, image in enumerate(row["media"])}
        result = module.with_media(content, row["media"], ids)
        self.assertNotEqual(result["states"][0]["iconAssetId"], result["states"][1]["iconAssetId"])
        self.assertEqual(len(result["referenceImages"]), 1)
        self.assertNotEqual(result["referenceImages"][0]["assetId"], result["states"][1]["iconAssetId"])
        self.assertEqual(content["referenceImages"], [])

    def test_arcana_labels_are_translatable_and_source_typo_does_not_create_a_new_stat(self):
        for row in self.plan["rows"]:
            if row["kind"] != "arcana":
                continue
            labels = row["content"]["translations"][0]["statLabels"]
            for attribute, stat in zip(row["source"]["attributes"], row["content"]["stats"]):
                self.assertEqual(labels[stat["key"]], attribute["name"])
                self.assertEqual(stat["value"], attribute["value"])
                self.assertEqual(stat["unit"], attribute.get("unit"))
        self.assertEqual(module.STAT_KEYS["Công vậy lý"], module.STAT_KEYS["Công vật lý"])

    def test_recipe_cycles_and_unverified_relationships_are_rejected(self):
        items = [{"id": "a", "recipe": {"status": "verified", "components": [{"itemId": "b", "quantity": 1}]}},
                 {"id": "b", "recipe": {"status": "verified", "components": [{"itemId": "a", "quantity": 1}]}}]
        with self.assertRaisesRegex(ValueError, "cycle"):
            module.validate_recipes(items)
        items[0]["recipe"]["status"] = "unverified"
        with self.assertRaisesRegex(ValueError, "Unverified"):
            module.validate_recipes(items)

    def test_paths_outside_resources_cannot_be_uploaded(self):
        for path in ["assets/../../outside.jpg", "C:/outside.jpg", "assets\\image.jpg", "https://example.com/image.jpg"]:
            with self.assertRaises(ValueError):
                module.resource_file(path)

    def test_completed_upload_is_verified_and_reused_without_sending_image_bytes(self):
        importer = module.Importer.__new__(module.Importer)
        image = self.plan["media"][0]
        key = image["semantic"] + ":" + image["path"]
        importer.state = {"assets": {key: {"assetId": "existing", "sha256": image["sha256"], "complete": True}}}
        importer.lock = module.threading.RLock()
        importer.uploaded, importer.reused = 0, 0
        importer.api = Mock()
        importer.api.call.return_value = {"semanticType": image["semantic"], "state": "ACTIVE", "currentVersionId": "version"}
        with patch.object(module.image_helpers, "urlopen") as upload:
            self.assertEqual(importer.upload(image), "existing")
        upload.assert_not_called()
        importer.api.call.assert_called_once_with("/admin/media/assets/existing")
        self.assertEqual(importer.reused, 1)

    def test_external_draft_edits_are_not_overwritten_but_saved_put_can_resume(self):
        row = copy.deepcopy(self.row("arcana", "xanh-1-giap-phep"))
        row["media"] = []
        importer = module.Importer.__new__(module.Importer)
        importer.plan = {"rows": [row]}
        key = "arcana:" + row["code"]
        initial = {**row["content"], "notes": "Initial content"}
        external = {**initial, "notes": "Someone edited this draft"}
        importer.state = {"records": {key: {"id": "identity", "draftId": "draft", "initialDigest": module.digest(initial)}}}
        importer.checkpoint = Mock()
        importer.api = Mock()
        importer.api.call.return_value = {"revision": {"state": "DRAFT", "version": 3}, "content": external}
        with self.assertRaisesRegex(ValueError, "external edits"):
            importer.apply_records({}, {})
        self.assertEqual(importer.api.call.call_count, 1)
        importer.api.call.reset_mock()
        importer.api.call.return_value = {"revision": {"state": "DRAFT", "version": 3}, "content": row["content"]}
        importer.apply_records({}, {})
        self.assertEqual(importer.api.call.call_count, 1)
        self.assertEqual(importer.state["records"][key]["digest"], module.digest(row["content"]))

    def test_identity_creation_can_resume_after_response_arrived_without_a_checkpoint(self):
        row = copy.deepcopy(self.row("items", "kiem-ngan"))
        current = {"id": "existing", "code": row["code"], "revision": {"id": "draft", "state": "DRAFT"},
                   "content": module.initial_content(row)}
        importer = module.Importer.__new__(module.Importer)
        importer.plan = {"rows": [row]}
        importer.ruleset = {"id": "ruleset"}
        importer.state = {"records": {}}
        importer.api = Mock()
        importer.checkpoint = Mock()
        with patch.object(module, "all_pages", side_effect=lambda api, path, **query: [current] if path.endswith("/items") else []):
            importer.identities()
        self.assertEqual(importer.state["records"]["items:kiem-ngan"]["draftId"], "draft")
        importer.api.call.assert_not_called()
        importer.state["records"] = {}
        current["content"]["price"] = 999
        with patch.object(module, "all_pages", side_effect=lambda api, path, **query: [current] if path.endswith("/items") else []):
            with self.assertRaisesRegex(ValueError, "unmodified import draft"):
                importer.identities()


if __name__ == "__main__":
    unittest.main()
