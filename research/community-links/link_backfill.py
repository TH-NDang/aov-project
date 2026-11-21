"""Plans and applies the links of ADR-032 from the text the Liquipedia import left (spec 04, backfill).

    python link_backfill.py plan export.json --out DIR
    python link_backfill.py apply DIR/plan.json --api https://HOST/api/community/v1 --ledger DIR/ledger.jsonl
    python link_backfill.py undo DIR/ledger.jsonl --api https://HOST/api/community/v1

`plan` only reads the export made by export-links.sql. It proposes a link only when the text matches exactly one
record in a scope that makes the match certain, and writes everything else to review.tsv. `apply` and `undo` call the
Admin API with the bearer token in COMMUNITY_ADMIN_TOKEN (never printed): each record is read again, changed only
where the field is still empty, and saved with its version. Every save is written to the ledger so `undo` can put the
previous values back.
"""

import argparse
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from collections import defaultdict

COMBINING = re.compile("[̀-ͯ]")
SPACES = re.compile(r"\s+")
PUNCTUATION = re.compile(r"[,.;:!?()\[\]|\"'“”]")
GAME_MVP = re.compile(r"MVP: ([^\n]*)")
SERIES_MVP = re.compile(r"^MVP(?: trận)?: ([^\n(]*)", re.MULTILINE)
SERIES_CASTERS = re.compile(r"^Bình luận: ([^\n]*)", re.MULTILINE)
CASTER_SEPARATOR = re.compile(r"\s*(?:,|&|/|\bvà\b|\band\b)\s*")
MVP_CONTINUATION = re.compile(r"\s+(?:Tuyển thủ theo vị trí|Liquipedia |Video ván|Tên tướng|Thời lượng)", re.IGNORECASE)
BRACKETED = re.compile(r"\s*\([^)]*\)")

BROADCAST_ROLES = {
    "mc": "HOST",
    "host": "HOST",
    "dan chuong trinh": "HOST",
    "binh luan vien": "CASTER",
    "binh luan": "CASTER",
    "caster": "CASTER",
    "commentator": "CASTER",
    "phong van": "INTERVIEWER",
    "phong vien": "INTERVIEWER",
    "interviewer": "INTERVIEWER",
    "khach moi phan tich": "GUEST_ANALYST",
    "khach moi": "GUEST_ANALYST",
    "guest analyst": "GUEST_ANALYST",
    "analyst": "GUEST_ANALYST",
}
COACH_PREFIXES = ("huan luyen vien", "tro ly huan luyen vien", "hlv", "coach", "head coach", "assistant coach")
ANALYST_WORDS = ("phan tich", "analyst")


def fold(value):
    """The name as tournament.normalize_reference_search folds it: no accents, đ as d, lower case, single spaces."""
    if value is None:
        return ""
    text = COMBINING.sub("", unicodedata.normalize("NFD", value)).replace("đ", "d").replace("Đ", "D")
    return SPACES.sub(" ", text.lower()).strip()


def key(value):
    """A folded name with punctuation read as a space, so "Zane," and "Zane" compare alike."""
    return SPACES.sub(" ", PUNCTUATION.sub(" ", fold(value))).strip()


def base_url(url):
    """A source URL without its fragment: "…/Winter#Broadcast" names the same page as "…/Winter"."""
    return (url or "").split("#", 1)[0].strip()


def game_mvp_text(note):
    match = GAME_MVP.search(note or "")
    return match.group(1).strip() if match else None


def series_mvp_name(note):
    match = SERIES_MVP.search(note or "")
    return match.group(1).strip() if match else None


def series_caster_names(note):
    match = SERIES_CASTERS.search(note or "")
    if not match:
        return []
    return [name.strip() for name in CASTER_SEPARATOR.split(match.group(1)) if name.strip()]


def broadcast_role(role_text):
    return BROADCAST_ROLES.get(key(role_text))


def staff_role(role_text):
    folded = key(role_text)
    if any(folded == prefix or folded.startswith(prefix + " ") for prefix in COACH_PREFIXES):
        return "COACH"
    if any(word in folded for word in ANALYST_WORDS):
        return "TEAM_ANALYST"
    return None


def names_of_player(player):
    return {key(name) for name in [player.get("nickname"), *player.get("aliases", [])] if key(name)}


def names_of_team(team):
    names = [team.get("name"), team.get("shortName"), *team.get("aliases", [])]
    return {key(name) for name in names if key(name)}


def mvp_names(text):
    """
    The names the MVP part of a game note gives. The part ends where the importer's next sentence starts; a Liquipedia
    link may write "Page (Taiwanese Player)|Shown", so each side of the bar counts, with and without the bracket.
    """
    segment = MVP_CONTINUATION.split(text or "", maxsplit=1)[0].strip()
    forms = {segment, BRACKETED.sub("", segment)}
    for part in segment.split("|"):
        forms |= {part, BRACKETED.sub("", part)}
    return {key(form) for form in forms if key(form)}


def mvp_in_text(text, candidates):
    """The one candidate the MVP part of a note names exactly; None when no candidate or several do."""
    said = mvp_names(text)
    found = {player_id for player_id, names in candidates.items() if names & said}
    return found.pop() if len(found) == 1 else None


def named_by(text, candidates):
    """Whether any candidate has one of the names the MVP part of a note gives."""
    said = mvp_names(text)
    return any(names & said for names in candidates.values())


def exactly_one(name, candidates):
    """The one candidate that has this name; None when none or several do."""
    wanted = key(name)
    found = {candidate_id for candidate_id, names in candidates.items() if wanted and wanted in names}
    return found.pop() if len(found) == 1 else None


class Data:
    """The export indexed for matching."""

    def __init__(self, export):
        self.tournaments = {row["id"]: row for row in export["tournaments"]}
        self.teams = {row["id"]: row for row in export["teams"]}
        self.players = {row["id"]: row for row in export["players"]}
        self.series = {row["id"]: row for row in export["series"]}
        self.games = export["games"]
        self.pages = export["pages"]
        self.team_pages = {row["id"]: row for row in export["pages"] if row["kind"] == "TEAM"}
        self.roster = defaultdict(set)
        self.tournament_teams = defaultdict(set)
        self.team_members = defaultdict(set)
        for row in export["rosters"]:
            self.roster[(row["tournamentId"], row["teamId"])].add(row["playerId"])
            self.tournament_teams[row["tournamentId"]].add(row["teamId"])
            self.team_members[row["teamId"]].add(row["playerId"])
        for row in self.series.values():
            for team in (row["teamAId"], row["teamBId"]):
                if team:
                    self.tournament_teams[row["tournamentId"]].add(team)
        for row in self.tournaments.values():
            for line in row.get("placements", []):
                if line.get("teamId"):
                    self.tournament_teams[row["id"]].add(line["teamId"])
        self.by_source = defaultdict(list)
        for row in self.tournaments.values():
            if base_url(row.get("sourceUrl")):
                self.by_source[base_url(row["sourceUrl"])].append(row)
        self.individuals = {row["id"]: {key(row.get("name"))} for row in self.pages
                            if row["kind"] in ("PERSON", "PLAYER") and key(row.get("name"))}

    def live_player(self, player_id):
        row = self.players.get(player_id)
        return row is not None and not row["deleted"]

    def live_team(self, team_id):
        row = self.teams.get(team_id)
        return row is not None and not row["deleted"]

    def series_candidates(self, series):
        ids = set()
        for team in (series["teamAId"], series["teamBId"]):
            ids |= self.roster[(series["tournamentId"], team)]
        return {player_id: names_of_player(self.players[player_id]) for player_id in ids
                if self.live_player(player_id)}

    def team_history_candidates(self, series):
        """Players with a roster line on either team in any tournament: the rosters of a match are often incomplete."""
        ids = set()
        for team in (series["teamAId"], series["teamBId"]):
            if team:
                ids |= self.team_members[team]
        return {player_id: names_of_player(self.players[player_id]) for player_id in ids
                if self.live_player(player_id)}


class Plan:
    def __init__(self):
        self.changes = []
        self.review = []
        self.counts = defaultdict(lambda: defaultdict(int))

    def link(self, category, change):
        self.changes.append(change)
        self.counts[category]["linked"] += 1

    def skip(self, category, record_id, text, reason):
        self.review.append((category, record_id, text, reason))
        self.counts[category][reason] += 1


def plan_game_mvps(data, plan):
    for game in data.games:
        series = data.series.get(game["seriesId"])
        text = game_mvp_text(game.get("note"))
        if series is None or game.get("mvpPlayerId") or text is None:
            continue
        candidates = data.series_candidates(series)
        for player_id in game.get("players", []):
            if data.live_player(player_id):
                candidates[player_id] = names_of_player(data.players[player_id])
        player = mvp_in_text(text, candidates)
        evidence = text
        if player is None and not named_by(text, candidates):
            player = mvp_in_text(text, data.team_history_candidates(series))
            evidence = f"{text} (team history)"
        if player is None:
            plan.skip("GAME_MVP", game["id"], text, "no single player of the two rosters")
            continue
        plan.link("GAME_MVP", {"record": "game", "id": game["id"], "field": "mvpPlayerId", "value": player,
                               "evidence": evidence})


def plan_series(data, plan):
    for series in data.series.values():
        name = series_mvp_name(series.get("note"))
        if name and not series.get("mvpPlayerId"):
            candidates = data.series_candidates(series)
            player = exactly_one(name, candidates)
            evidence = name
            if player is None and not any(key(name) in names for names in candidates.values()):
                player = exactly_one(name, data.team_history_candidates(series))
                evidence = f"{name} (team history)"
            if player is None:
                plan.skip("SERIES_MVP", series["id"], name, "no single player of the two rosters")
            else:
                plan.link("SERIES_MVP", {"record": "series", "id": series["id"], "field": "mvpPlayerId",
                                         "value": player, "evidence": evidence})
        casters = series_caster_names(series.get("note"))
        if casters and not series.get("broadcast"):
            pages = [exactly_one(caster, data.individuals) for caster in casters]
            if None in pages:
                plan.skip("SERIES_BROADCAST", series["id"], ", ".join(casters), "a caster has no single profile")
                continue
            crew = [{"pageId": page, "role": "CASTER"} for page in dict.fromkeys(pages)]
            plan.link("SERIES_BROADCAST", {"record": "series", "id": series["id"], "field": "broadcast",
                                           "value": crew, "evidence": ", ".join(casters)})


def plan_tournament_crews(data, plan):
    """Broadcast crews and team staff from the history entries of individual pages."""
    broadcast = defaultdict(dict)
    staff = defaultdict(dict)
    for page in data.pages:
        if page["kind"] not in ("PERSON", "PLAYER"):
            continue
        for entry in page.get("history", []):
            url = entry.get("sourceUrl") or ""
            matches = [row for row in data.by_source.get(base_url(url), []) if not row["deleted"]]
            if len(matches) != 1:
                continue
            tournament = matches[0]
            role_text = entry.get("role") or ""
            if url.endswith("#Broadcast"):
                role = broadcast_role(role_text)
                if role is None:
                    plan.skip("TOURNAMENT_BROADCAST", tournament["id"], f"{page['name']} · {role_text}",
                              "unknown broadcast role")
                    continue
                broadcast[tournament["id"]][(page["id"], role)] = {"pageId": page["id"], "role": role}
                continue
            role = staff_role(role_text)
            team_page = data.team_pages.get(entry.get("relatedPageId") or "")
            if role is None or team_page is None:
                continue
            team = team_page.get("entityId")
            if not data.live_team(team):
                plan.skip("TOURNAMENT_STAFF", tournament["id"], f"{page['name']} · {role_text}", "team is trashed")
                continue
            staff[tournament["id"]][(team, page["id"], role)] = {"teamId": team, "pageId": page["id"],
                                                                "role": role, "title": role_text.strip() or None}
    for tournament_id, crew in broadcast.items():
        if data.tournaments[tournament_id].get("broadcast"):
            continue
        plan.link("TOURNAMENT_BROADCAST", {"record": "tournament", "id": tournament_id, "field": "broadcast",
                                           "value": list(crew.values()), "evidence": "#Broadcast history"})
    for tournament_id, lines in staff.items():
        if data.tournaments[tournament_id].get("staff"):
            continue
        plan.link("TOURNAMENT_STAFF", {"record": "tournament", "id": tournament_id, "field": "staff",
                                       "value": list(lines.values()), "evidence": "staff history"})


def plan_history(data, plan):
    for page in data.pages:
        for index, entry in enumerate(page.get("history", [])):
            if entry.get("tournamentId") or not base_url(entry.get("sourceUrl")):
                continue
            matches = data.by_source.get(base_url(entry["sourceUrl"]), [])
            if len(matches) != 1:
                plan.skip("PROFILE_HISTORY", page["id"], entry.get("title", ""), "source names no single tournament")
                continue
            plan.link("PROFILE_HISTORY", {"record": "page", "id": page["id"], "field": "history.tournamentId",
                                          "index": index, "value": matches[0]["id"],
                                          "match": {"title": entry.get("title"), "sourceUrl": entry.get("sourceUrl")},
                                          "evidence": entry.get("title", "")})


def plan_award_teams(data, plan):
    for tournament in data.tournaments.values():
        if tournament["deleted"]:
            continue
        candidates = {team: names_of_team(data.teams[team]) for team in data.tournament_teams[tournament["id"]]
                      if data.live_team(team)}
        for index, award in enumerate(tournament.get("awards", [])):
            if award.get("teamId") or not (award.get("teamName") or "").strip():
                continue
            team = exactly_one(award["teamName"], candidates)
            if team is None:
                plan.skip("AWARD_TEAM", tournament["id"], award["teamName"], "no single team of the tournament")
                continue
            plan.link("AWARD_TEAM", {"record": "tournament", "id": tournament["id"], "field": "awards.teamId",
                                     "index": index, "value": team,
                                     "match": {"title": award.get("title"), "teamName": award.get("teamName")},
                                     "evidence": award["teamName"]})


def build_plan(export):
    data = Data(export)
    plan = Plan()
    plan_game_mvps(data, plan)
    plan_series(data, plan)
    plan_tournament_crews(data, plan)
    plan_history(data, plan)
    plan_award_teams(data, plan)
    return plan


# Applying a plan through the Admin API.

PATHS = {"game": "/admin/games/", "series": "/admin/series/", "tournament": "/admin/tournaments/",
         "page": "/admin/pages/"}


def change_content(content, change):
    """Applies one change if its field is still empty; returns the previous value, or a reason to leave it."""
    field = change["field"]
    if field in ("mvpPlayerId",):
        if content.get(field):
            return None, "already linked"
        content[field] = change["value"]
        return {"value": None}, None
    if field in ("broadcast", "staff"):
        if content.get(field):
            return None, "already filled"
        content[field] = change["value"]
        return {"value": []}, None
    list_name, item_field = field.split(".")
    items = content.get(list_name) or []
    index = change["index"]
    if index >= len(items) or any(items[index].get(name) != value for name, value in change["match"].items()):
        return None, "entry moved or changed"
    if items[index].get(item_field):
        return None, "already linked"
    items[index][item_field] = change["value"]
    return {"value": None}, None


def revert_content(content, change):
    field = change["field"]
    if "." not in field:
        if content.get(field) != change["value"]:
            return False
        content[field] = change["before"]["value"]
        return True
    list_name, item_field = field.split(".")
    items = content.get(list_name) or []
    index = change["index"]
    if index >= len(items) or items[index].get(item_field) != change["value"]:
        return False
    items[index][item_field] = change["before"]["value"]
    return True


class AdminApi:
    def __init__(self, base, token):
        self.base = base.rstrip("/")
        self.token = token

    def call(self, method, path, body=None):
        data = None if body is None else json.dumps(body).encode("utf-8")
        request = urllib.request.Request(self.base + path, data=data, method=method)
        request.add_header("Authorization", "Bearer " + self.token)
        request.add_header("Accept", "application/json")
        if data is not None:
            request.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.status, json.loads(response.read() or b"null")
        except urllib.error.HTTPError as error:
            try:
                problem = json.loads(error.read() or b"null")
            except ValueError:
                problem = None
            return error.code, problem


def grouped(changes):
    records = defaultdict(list)
    for change in changes:
        records[(change["record"], change["id"])].append(change)
    return records


def apply_plan(plan_changes, api, ledger):
    done = failed = skipped = 0
    for (record, record_id), changes in grouped(plan_changes).items():
        for attempt in range(2):
            status, view = api.call("GET", PATHS[record] + record_id)
            if status != 200:
                ledger.write(json.dumps({"record": record, "id": record_id, "error": status}) + "\n")
                failed += 1
                break
            content = view["content"]
            applied = []
            for change in changes:
                before, reason = change_content(content, change)
                if reason is None:
                    applied.append({**change, "before": before})
            if not applied:
                skipped += 1
                break
            status, saved = api.call("PUT", PATHS[record] + record_id, {"version": view["version"],
                                                                         "content": content})
            if status == 200:
                ledger.write(json.dumps({"record": record, "id": record_id, "version": saved["version"],
                                         "changes": applied}, ensure_ascii=False) + "\n")
                done += 1
                break
            code = (saved or {}).get("code")
            if code == "VERSION_CONFLICT" and attempt == 0:
                continue
            ledger.write(json.dumps({"record": record, "id": record_id, "error": status, "code": code}) + "\n")
            failed += 1
            break
        ledger.flush()
    return done, skipped, failed


def undo_ledger(lines, api):
    done = failed = 0
    for line in reversed(lines):
        entry = json.loads(line)
        if "changes" not in entry:
            continue
        status, view = api.call("GET", PATHS[entry["record"]] + entry["id"])
        if status != 200:
            failed += 1
            continue
        content = view["content"]
        if not any([revert_content(content, change) for change in entry["changes"]]):
            continue
        status, _ = api.call("PUT", PATHS[entry["record"]] + entry["id"], {"version": view["version"],
                                                                            "content": content})
        if status == 200:
            done += 1
        else:
            failed += 1
    return done, failed


def write_plan(plan, out):
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "plan.json"), "w", encoding="utf-8") as handle:
        json.dump(plan.changes, handle, ensure_ascii=False, indent=1)
    with open(os.path.join(out, "review.tsv"), "w", encoding="utf-8") as handle:
        handle.write("category\trecordId\ttext\treason\n")
        for row in plan.review:
            handle.write("\t".join(str(value).replace("\t", " ").replace("\n", " ") for value in row) + "\n")
    summary = {category: dict(counts) for category, counts in sorted(plan.counts.items())}
    with open(os.path.join(out, "summary.json"), "w", encoding="utf-8") as handle:
        json.dump(summary, handle, ensure_ascii=False, indent=1)
    return summary


def token():
    value = os.environ.get("COMMUNITY_ADMIN_TOKEN", "").strip()
    if not value:
        raise SystemExit("Set COMMUNITY_ADMIN_TOKEN to an Admin access token with tournament:write.")
    return value


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    planning = commands.add_parser("plan")
    planning.add_argument("export")
    planning.add_argument("--out", required=True)
    applying = commands.add_parser("apply")
    applying.add_argument("plan")
    applying.add_argument("--api", required=True)
    applying.add_argument("--ledger", required=True)
    undoing = commands.add_parser("undo")
    undoing.add_argument("ledger")
    undoing.add_argument("--api", required=True)
    args = parser.parse_args(argv)

    if args.command == "plan":
        with open(args.export, encoding="utf-8") as handle:
            summary = write_plan(build_plan(json.load(handle)), args.out)
        print(json.dumps(summary, ensure_ascii=False, indent=1))
    elif args.command == "apply":
        with open(args.plan, encoding="utf-8") as handle:
            changes = json.load(handle)
        with open(args.ledger, "a", encoding="utf-8") as ledger:
            done, skipped, failed = apply_plan(changes, AdminApi(args.api, token()), ledger)
        print(f"saved {done}, unchanged {skipped}, failed {failed}")
    else:
        with open(args.ledger, encoding="utf-8") as handle:
            lines = [line for line in handle if line.strip()]
        done, failed = undo_ledger(lines, AdminApi(args.api, token()))
        print(f"reverted {done}, failed {failed}")


if __name__ == "__main__":
    main(sys.argv[1:])
