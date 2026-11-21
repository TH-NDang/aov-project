import importlib.util
from pathlib import Path
import unittest


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("correct_enchantments", HERE / "correct-enchantments.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def row(code, description="Cũ", cooldown=None, other_locale=True):
    translations = [{"locale": "vi-VN", "name": "Tên", "summary": "Cũ", "description": description}]
    if other_locale:
        translations.append({"locale": "en-US", "name": "Name", "summary": "Old", "description": "Old"})
    return {"code": code, "revision": {"state": "PUBLISHED"}, "content": {"branchCode": "b", "tier": 1, "position": 0, "cooldownSeconds": cooldown,
                                      "translations": translations}}


CORRECTIONS = {"locale": "vi-VN", "enchantments": {
    "a": {"summary": "Mới", "description": "Mới.", "activation": "PASSIVE", "cooldownSeconds": 10},
}}


class CorrectEnchantmentsTest(unittest.TestCase):
    def test_a_correction_replaces_the_locale_text_and_keeps_other_translations(self):
        content = module.corrected(row("a")["content"], CORRECTIONS["enchantments"]["a"], "vi-VN")
        self.assertEqual(content["translations"][0]["description"], "Mới.")
        self.assertEqual(content["translations"][1]["description"], "Old")

    def test_a_correction_keeps_the_place_in_the_branch(self):
        content = module.corrected(row("a")["content"], CORRECTIONS["enchantments"]["a"], "vi-VN")
        self.assertEqual((content["branchCode"], content["tier"], content["position"]), ("b", 1, 0))

    def test_an_enchantment_that_differs_is_planned_for_a_change(self):
        self.assertEqual(module.plan([row("a")], CORRECTIONS)["change"], ["a"])

    def test_an_enchantment_that_already_matches_is_left_alone(self):
        same = row("a", description="Mới.", cooldown=10.0)
        same["content"]["translations"][0]["summary"] = "Mới"
        same["content"]["activation"] = "PASSIVE"
        self.assertEqual(module.plan([same], CORRECTIONS)["same"], ["a"])

    def test_an_enchantment_with_an_open_draft_is_not_touched(self):
        draft = row("a")
        draft["revision"]["state"] = "DRAFT"
        self.assertEqual(module.plan([draft], CORRECTIONS)["busy"], ["a"])

    def test_a_code_the_catalog_lacks_is_reported(self):
        self.assertEqual(module.plan([], CORRECTIONS)["unknown"], ["a"])

    def test_a_translation_leaves_the_gameplay_as_it_was(self):
        content = row("a", cooldown=10)["content"]
        content["activation"] = "ACTIVE"
        translated = module.corrected(content, {"name": "Name", "description": "New."}, "en-US")
        self.assertEqual((translated["activation"], translated["cooldownSeconds"]), ("ACTIVE", 10))

    def test_the_english_file_covers_the_same_enchantments(self):
        english = module.load_corrections(module.HERE / "enchantment-translations-en.json")["enchantments"]
        self.assertEqual(set(english), set(module.load_corrections()["enchantments"]))

    def test_the_reviewed_file_covers_thirty_three_enchantments(self):
        self.assertEqual(len(module.load_corrections()["enchantments"]), 33)

    def test_an_items_file_plans_its_items_and_changes_only_the_english_text(self):
        corrections = {"kind": "items", "locale": "en-US", "items": {"a": {"description": "New."}}}
        item = {"code": "a", "revision": {"state": "PUBLISHED"},
                "content": {"tier": 3, "stats": [], "translations": [
                    {"locale": "vi-VN", "name": "Tên", "description": "Cũ"},
                    {"locale": "en-US", "name": "Name", "description": "Old."}]}}
        self.assertEqual(module.plan([item], corrections)["change"], ["a"])
        content = module.corrected(item["content"], corrections["items"]["a"], "en-US")
        self.assertEqual([row["description"] for row in content["translations"]], ["Cũ", "New."])

    def test_the_english_item_file_lines_its_effects_up_with_the_vietnamese_text(self):
        corrections = module.load_corrections(HERE / "item-translations-en.json")
        self.assertEqual(corrections["kind"], "items")
        self.assertEqual(corrections["cause"], "TRANSLATION_UPDATE")
        self.assertEqual(len(corrections["items"]), 90)


if __name__ == "__main__":
    unittest.main()
