import copy
import io
import json
import unittest

import link_backfill as backfill

TOURNAMENT = "t-1"
TEAM_A, TEAM_B = "team-a", "team-b"
STARK, ZANE, ZANE_X = "p-stark", "p-zane", "p-zane-x"
CASTER, COACH = "page-caster", "page-coach"


def export():
    return {
        "tournaments": [{"id": TOURNAMENT, "deleted": False, "name": "AOG Winter",
                         "sourceUrl": "https://liquipedia.net/aov/AOG/Winter",
                         "awards": [{"title": "MVP", "recipientName": "Stark", "teamName": "Saigon Phantom"}],
                         "placements": [], "broadcast": [], "staff": []}],
        "teams": [{"id": TEAM_A, "deleted": False, "name": "Saigon Phantom", "shortName": "SGP", "aliases": []},
                  {"id": TEAM_B, "deleted": False, "name": "Box Gaming", "shortName": "BOX", "aliases": []}],
        "players": [{"id": STARK, "deleted": False, "nickname": "Stark", "aliases": []},
                    {"id": ZANE, "deleted": False, "nickname": "Zane", "aliases": []},
                    {"id": ZANE_X, "deleted": False, "nickname": "Zane X", "aliases": []}],
        "rosters": [{"tournamentId": TOURNAMENT, "teamId": TEAM_A, "playerId": STARK},
                    {"tournamentId": TOURNAMENT, "teamId": TEAM_B, "playerId": ZANE}],
        "series": [{"id": "s-1", "tournamentId": TOURNAMENT, "teamAId": TEAM_A, "teamBId": TEAM_B,
                    "note": "MVP trận: Stark (66.67%)\nBình luận: Trần Nam, Ghost", "mvpPlayerId": None,
                    "broadcast": []},
                   {"id": "s-2", "tournamentId": TOURNAMENT, "teamAId": TEAM_A, "teamBId": TEAM_B,
                    "note": "Bình luận: Trần Nam", "mvpPlayerId": None, "broadcast": []}],
        "games": [{"id": "g-1", "seriesId": "s-1", "note": "Liquipedia không ghi màu sân. MVP: Stark", "players": [],
                   "mvpPlayerId": None},
                  {"id": "g-2", "seriesId": "s-1", "note": "MVP: Nobody", "players": [], "mvpPlayerId": None}],
        "pages": [
            {"id": CASTER, "kind": "PERSON", "entityId": None, "name": "Trần Nam",
             "history": [{"title": "AOG Winter", "role": "Bình luận viên",
                          "sourceUrl": "https://liquipedia.net/aov/AOG/Winter#Broadcast"}]},
            {"id": COACH, "kind": "PERSON", "entityId": None, "name": "Coach",
             "history": [{"title": "AOG Winter · Saigon Phantom", "role": "Trợ lý huấn luyện viên",
                          "relatedPageId": "page-team-a", "sourceUrl": "https://liquipedia.net/aov/AOG/Winter"}]},
            {"id": "page-team-a", "kind": "TEAM", "entityId": TEAM_A, "name": "Saigon Phantom", "history": []},
        ],
    }


def changes_of(plan, field):
    return [change for change in plan.changes if change["field"] == field]


class NameTest(unittest.TestCase):
    def test_a_name_folds_like_the_database_search(self):
        self.assertEqual(backfill.fold("  Trần   NAM Đức "), "tran nam duc")

    def test_punctuation_after_a_name_reads_as_a_space(self):
        self.assertEqual(backfill.key("Zane, tuyển thủ"), "zane tuyen thu")

    def test_a_source_url_is_compared_without_its_fragment(self):
        self.assertEqual(backfill.base_url("https://x/AOG/Winter#Broadcast"), "https://x/AOG/Winter")


class NoteTest(unittest.TestCase):
    def test_a_game_note_gives_the_text_after_mvp_to_the_end_of_the_line(self):
        self.assertEqual(backfill.game_mvp_text("Màu sân không rõ. MVP: Boka Ghi chú\nkhác"), "Boka Ghi chú")

    def test_a_series_mvp_line_leaves_out_the_rating(self):
        self.assertEqual(backfill.series_mvp_name("Video\nMVP trận: Stark (66.67%) postponed"), "Stark")

    def test_casters_are_split_on_commas_and_the_word_va(self):
        self.assertEqual(backfill.series_caster_names("Bình luận: Hoàng Sơn, Trần Nam và JEX"),
                         ["Hoàng Sơn", "Trần Nam", "JEX"])

    def test_broadcast_and_staff_roles_read_from_their_wording(self):
        self.assertEqual(backfill.broadcast_role("MC"), "HOST")
        self.assertEqual(backfill.broadcast_role("Khách mời phân tích"), "GUEST_ANALYST")
        self.assertEqual(backfill.staff_role("Trợ lý huấn luyện viên"), "COACH")
        self.assertEqual(backfill.staff_role("Chuyên viên phân tích đội tuyển"), "TEAM_ANALYST")
        self.assertIsNone(backfill.staff_role("OG-Fixxy"))


class MatchTest(unittest.TestCase):
    def test_the_mvp_part_of_a_note_ends_where_the_importer_s_next_sentence_starts(self):
        candidates = {STARK: {"stark"}, ZANE: {"zane"}}
        self.assertEqual(backfill.mvp_in_text("Stark Tuyển thủ theo vị trí được suy ra", candidates), STARK)

    def test_a_liquipedia_link_names_the_player_on_either_side_of_its_bar(self):
        candidates = {STARK: {"kai"}, ZANE: {"zane"}}
        self.assertEqual(backfill.mvp_in_text("Kai (Taiwanese Player)|Kai Tuyển thủ theo vị trí", candidates), STARK)

    def test_a_name_that_only_starts_the_mvp_name_is_not_a_match(self):
        candidates = {STARK: {"red"}}
        self.assertIsNone(backfill.mvp_in_text("Red Fox", candidates))

    def test_two_players_named_by_one_note_leave_the_mvp_for_review(self):
        candidates = {ZANE: {"medusa"}, ZANE_X: {"sa"}}
        self.assertIsNone(backfill.mvp_in_text("Medusa|Sa", candidates))


class PlanTest(unittest.TestCase):
    def setUp(self):
        self.plan = backfill.build_plan(export())

    def test_a_game_mvp_named_in_the_rosters_is_linked_and_an_unknown_one_is_left_for_review(self):
        self.assertEqual([(c["id"], c["value"]) for c in changes_of(self.plan, "mvpPlayerId") if c["record"] == "game"],
                         [("g-1", STARK)])
        self.assertIn(("GAME_MVP", "g-2", "Nobody", "no single player of the two rosters"), self.plan.review)

    def test_a_game_mvp_missing_from_the_rosters_is_linked_through_the_team_history(self):
        data = export()
        data["players"].append({"id": "p-kai", "deleted": False, "nickname": "Kai", "aliases": []})
        data["rosters"].append({"tournamentId": "t-old", "teamId": TEAM_B, "playerId": "p-kai"})
        data["games"].append({"id": "g-3", "seriesId": "s-1", "note": "MVP: Kai", "players": [], "mvpPlayerId": None})
        plan = backfill.build_plan(data)
        self.assertIn(("g-3", "p-kai"), [(c["id"], c["value"]) for c in changes_of(plan, "mvpPlayerId")])

    def test_the_team_history_is_not_asked_when_the_rosters_name_several_players(self):
        data = export()
        data["players"].append({"id": "p-zane-2", "deleted": False, "nickname": "Zane", "aliases": []})
        data["rosters"].append({"tournamentId": TOURNAMENT, "teamId": TEAM_A, "playerId": "p-zane-2"})
        data["games"].append({"id": "g-3", "seriesId": "s-1", "note": "MVP: Zane", "players": [], "mvpPlayerId": None})
        plan = backfill.build_plan(data)
        self.assertNotIn("g-3", [c["id"] for c in changes_of(plan, "mvpPlayerId")])

    def test_a_namesake_who_never_played_for_either_team_is_left_for_review(self):
        data = export()
        data["players"].append({"id": "p-kai", "deleted": False, "nickname": "Kai", "aliases": []})
        data["games"].append({"id": "g-3", "seriesId": "s-1", "note": "MVP: Kai", "players": [], "mvpPlayerId": None})
        plan = backfill.build_plan(data)
        self.assertIn(("GAME_MVP", "g-3", "Kai", "no single player of the two rosters"), plan.review)

    def test_a_series_mvp_is_linked_from_its_rated_line(self):
        series = [c for c in changes_of(self.plan, "mvpPlayerId") if c["record"] == "series"]
        self.assertEqual([(c["id"], c["value"]) for c in series], [("s-1", STARK)])

    def test_casters_are_linked_only_when_every_name_has_one_profile(self):
        crews = {c["id"]: c["value"] for c in changes_of(self.plan, "broadcast") if c["record"] == "series"}
        self.assertEqual(crews, {"s-2": [{"pageId": CASTER, "role": "CASTER"}]})

    def test_a_broadcast_history_entry_joins_the_crew_of_its_tournament(self):
        crews = [c for c in changes_of(self.plan, "broadcast") if c["record"] == "tournament"]
        self.assertEqual(crews[0]["value"], [{"pageId": CASTER, "role": "CASTER"}])

    def test_a_coach_history_entry_becomes_a_staff_line_with_its_wording(self):
        staff = changes_of(self.plan, "staff")[0]["value"]
        self.assertEqual(staff, [{"teamId": TEAM_A, "pageId": COACH, "role": "COACH",
                                  "title": "Trợ lý huấn luyện viên"}])

    def test_a_history_entry_names_the_one_tournament_of_its_source(self):
        linked = {(c["id"], c["index"]): c["value"] for c in changes_of(self.plan, "history.tournamentId")}
        self.assertEqual(linked, {(CASTER, 0): TOURNAMENT, (COACH, 0): TOURNAMENT})

    def test_an_award_team_named_like_one_team_of_the_tournament_is_linked(self):
        award = changes_of(self.plan, "awards.teamId")[0]
        self.assertEqual((award["index"], award["value"]), (0, TEAM_A))


class FakeApi:
    def __init__(self, records, conflicts=0):
        self.records = records
        self.conflicts = conflicts

    def call(self, method, path, body=None):
        record_id = path.rsplit("/", 1)[1]
        view = self.records[record_id]
        if method == "GET":
            return 200, copy.deepcopy(view)
        if self.conflicts:
            self.conflicts -= 1
            view["version"] += 1
            return 409, {"code": "VERSION_CONFLICT"}
        if body["version"] != view["version"]:
            return 409, {"code": "VERSION_CONFLICT"}
        view["content"] = body["content"]
        view["version"] += 1
        return 200, copy.deepcopy(view)


class ApplyTest(unittest.TestCase):
    def test_a_saved_link_is_written_to_the_ledger_and_undone_from_it(self):
        api = FakeApi({"g-1": {"version": 3, "content": {"mvpPlayerId": None}}})
        ledger = io.StringIO()

        result = backfill.apply_plan([{"record": "game", "id": "g-1", "field": "mvpPlayerId", "value": STARK}], api,
                                     ledger)
        undone = backfill.undo_ledger(ledger.getvalue().splitlines(), api)

        self.assertEqual(result, (1, 0, 0))
        self.assertEqual(json.loads(ledger.getvalue())["changes"][0]["value"], STARK)
        self.assertEqual(undone, (1, 0))
        self.assertIsNone(api.records["g-1"]["content"]["mvpPlayerId"])

    def test_a_field_an_editor_filled_meanwhile_is_left_alone(self):
        api = FakeApi({"g-1": {"version": 3, "content": {"mvpPlayerId": ZANE}}})

        result = backfill.apply_plan([{"record": "game", "id": "g-1", "field": "mvpPlayerId", "value": STARK}], api,
                                     io.StringIO())

        self.assertEqual(result, (0, 1, 0))
        self.assertEqual(api.records["g-1"]["content"]["mvpPlayerId"], ZANE)

    def test_a_version_conflict_is_read_again_once(self):
        api = FakeApi({"g-1": {"version": 3, "content": {"mvpPlayerId": None}}}, conflicts=1)

        result = backfill.apply_plan([{"record": "game", "id": "g-1", "field": "mvpPlayerId", "value": STARK}], api,
                                     io.StringIO())

        self.assertEqual(result, (1, 0, 0))

    def test_an_award_that_moved_since_the_plan_is_not_changed(self):
        content = {"awards": [{"title": "Finals MVP", "teamName": "Saigon Phantom"}]}
        change = {"record": "tournament", "id": TOURNAMENT, "field": "awards.teamId", "index": 0, "value": TEAM_A,
                  "match": {"title": "MVP", "teamName": "Saigon Phantom"}}

        before, reason = backfill.change_content(content, change)

        self.assertIsNone(before)
        self.assertEqual(reason, "entry moved or changed")


if __name__ == "__main__":
    unittest.main()
