import importlib.util
from pathlib import Path
import unittest


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("apply_item_gameplay", HERE / "apply-item-gameplay.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


PIERCE = {"stat": "magic-penetration", "value": 32, "maxValue": 60, "growth": "LEVEL", "cap": 150,
          "scalings": [{"source": "BONUS_HEALTH", "value": 3, "unit": "%"}]}
ENTRY = {"stats": [{"key": "magic-attack", "value": 120, "unit": None}],
         "effects": [{"key": "pha-phep", "activation": "PASSIVE", "unique": False, "cooldownSeconds": None,
                      "maxStacks": None, "grants": [PIERCE]}]}


def row(code, state="PUBLISHED", stats=None, effects=None):
    content = {"tier": 3, "stats": stats or [], "translations": [{"locale": "vi-VN", "name": "Tên", "description": "Mô tả"}]}
    if effects is not None:
        content["effects"] = effects
    return {"code": code, "revision": {"state": state}, "content": content}


class ApplyItemGameplayTest(unittest.TestCase):
    def test_applying_replaces_stats_and_effects_and_keeps_the_text(self):
        content = module.applied(row("a")["content"], ENTRY)
        self.assertEqual(content["stats"], ENTRY["stats"])
        self.assertEqual(content["effects"][0]["grants"][0]["stat"], "magic-penetration")
        self.assertEqual(content["translations"][0]["description"], "Mô tả")

    def test_an_item_the_backend_returns_with_the_same_gameplay_counts_as_unchanged(self):
        returned = {**PIERCE, "value": 32.0, "maxValue": 60.0, "unit": None, "durationSeconds": None, "target": "SELF"}
        stored = row("a", stats=[{"key": "magic-attack", "value": 120.0, "unit": None}],
                     effects=[{**ENTRY["effects"][0], "grants": [returned]}])
        work = module.plan([stored], {"items": {"a": ENTRY}})
        self.assertEqual(work["same"], ["a"])

    def test_an_item_without_effects_changes_an_open_draft_waits_and_an_unknown_code_is_reported(self):
        work = module.plan([row("a"), row("b", state="DRAFT")], {"items": {"a": ENTRY, "b": ENTRY, "c": ENTRY}})
        self.assertEqual(work, {"change": ["a"], "same": [], "busy": ["b"], "unknown": ["c"]})


if __name__ == "__main__":
    unittest.main()
