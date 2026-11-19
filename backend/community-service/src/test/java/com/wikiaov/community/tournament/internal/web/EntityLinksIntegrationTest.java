package com.wikiaov.community.tournament.internal.web;

import static com.wikiaov.community.testsupport.ApiCalls.ADMIN;
import static com.wikiaov.community.testsupport.ApiCalls.ROOT;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.wikiaov.community.testsupport.ApiCalls;
import com.wikiaov.community.testsupport.CommunityApplicationTest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Links between tournaments, matches, games, teams, players and profile pages (spec 04, ADR-032). */
@CommunityApplicationTest
class EntityLinksIntegrationTest {
    private static final String[] EDITOR = {"tournament:read", "tournament:write", "tournament:publish"};

    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @MockitoBean
    JwtDecoder decoder;

    private ApiCalls api;

    @BeforeEach
    void calls() {
        api = new ApiCalls(mvc, json);
    }

    @Test
    void aTournamentKeepsItsBroadcastCrewTeamStaffAndAwardTeamsAsLinks() throws Exception {
        String caster = page("PERSON", Map.of("name", "Caster", "personRoles", List.of("CASTER")));
        String coach = page("PERSON", Map.of("name", "Coach", "personRoles", List.of("COACH")));
        String team = record("teams", Map.of("code", code("team"), "name", "Linked team"));
        var content = tournament("Crewed");
        content.put("broadcast", List.of(Map.of("pageId", caster, "role", "CASTER")));
        content.put("staff", List.of(Map.of("teamId", team, "pageId", coach, "role", "COACH", "title",
                "  Trợ lý huấn luyện viên ")));
        content.put("awards", List.of(Map.of("title", "MVP", "recipientName", "Someone", "teamName", "Linked team",
                "teamId", team)));

        var saved = editor(post(ADMIN + "/tournaments"), Map.of("content", content), 200).path("content");

        assertThat(saved.path("broadcast").get(0).path("pageId").asString()).isEqualTo(caster);
        assertThat(saved.path("broadcast").get(0).path("role").asString()).isEqualTo("CASTER");
        assertThat(saved.path("staff").get(0).path("title").asString()).isEqualTo("Trợ lý huấn luyện viên");
        assertThat(saved.path("awards").get(0).path("teamId").asString()).isEqualTo(team);
    }

    @Test
    void aCrewLineThatNamesNoIndividualPageOrAnUnknownRoleIsRefused() throws Exception {
        String organization = page("ORGANIZATION", Map.of("name", "Organizer"));
        var byOrganization = tournament("Wrong crew");
        byOrganization.put("broadcast", List.of(Map.of("pageId", organization, "role", "HOST")));
        var unknownRole = tournament("Unknown role");
        unknownRole.put("broadcast", List.of(Map.of("pageId", page("PERSON",
                Map.of("name", "Host", "personRoles", List.of("HOST"))), "role", "DJ")));

        var refused = editor(post(ADMIN + "/tournaments"), Map.of("content", byOrganization), 400);
        var unreadable = editor(post(ADMIN + "/tournaments"), Map.of("content", unknownRole), 400);

        assertThat(refused.path("code").asString()).isEqualTo("TOURNAMENT_INVALID_CONTENT");
        assertThat(unreadable.path("code").asString()).isEqualTo("INVALID_REQUEST");
    }

    @Test
    void aFinalTableLineThatNamesATrashedTeamIsRefused() throws Exception {
        String team = record("teams", Map.of("code", code("gone"), "name", "Gone team"));
        editor(post(ADMIN + "/teams/" + team + "/delete"), Map.of("version", 0), 200);
        var content = tournament("Trashed placement");
        content.put("placements", List.of(Map.of("place", "1", "teamName", "Gone team", "teamId", team)));

        var refused = editor(post(ADMIN + "/tournaments"), Map.of("content", content), 409);

        assertThat(refused.path("code").asString()).isEqualTo("TOURNAMENT_RECORD_DELETED");
    }

    @Test
    void aTeamOnAFinalTableOrAStaffLineCannotBeDeleted() throws Exception {
        String placed = record("teams", Map.of("code", code("placed"), "name", "Placed team"));
        String coached = record("teams", Map.of("code", code("coached"), "name", "Coached team"));
        String coach = page("PERSON", Map.of("name", "Coach", "personRoles", List.of("COACH")));
        var content = tournament("Results");
        content.put("placements", List.of(Map.of("place", "1", "teamName", "Placed team", "teamId", placed)));
        content.put("staff", List.of(Map.of("teamId", coached, "pageId", coach, "role", "COACH")));
        record("tournaments", content);

        var placedImpact = editor(get(ADMIN + "/teams/" + placed + "/deletion-impact"), null, 200);
        var coachedImpact = editor(get(ADMIN + "/teams/" + coached + "/deletion-impact"), null, 200);
        var refused = editor(post(ADMIN + "/teams/" + placed + "/delete"), Map.of("version", 0), 409);

        assertThat(usageTypes(placedImpact)).contains("TOURNAMENT_RESULT");
        assertThat(usageTypes(coachedImpact)).contains("TOURNAMENT_STAFF");
        assertThat(refused.path("code").asString()).isEqualTo("TOURNAMENT_RECORD_IN_USE");
    }

    @Test
    void aPlayerWhoIsTheMvpOfAMatchOrAGameCannotBeDeleted() throws Exception {
        String matchMvp = record("players", Map.of("code", code("match-mvp"), "nickname", "Match MVP"));
        String gameMvp = record("players", Map.of("code", code("game-mvp"), "nickname", "Game MVP"));
        var series = series(record("tournaments", tournament("MVPs")));
        series.put("mvpPlayerId", matchMvp);
        String seriesId = record("series", series);
        record("games", Map.of("seriesId", seriesId, "number", 1, "region", "VN", "locale", "vi-VN", "sides",
                List.of(), "mvpPlayerId", gameMvp));

        var matchImpact = editor(get(ADMIN + "/players/" + matchMvp + "/deletion-impact"), null, 200);
        var gameImpact = editor(get(ADMIN + "/players/" + gameMvp + "/deletion-impact"), null, 200);

        assertThat(usageTypes(matchImpact)).containsExactly("SERIES");
        assertThat(usageTypes(gameImpact)).containsExactly("GAME");
    }

    @Test
    void aPersonInABroadcastCrewKeepsTheirDraftPageFromDeletion() throws Exception {
        String host = page("PERSON", Map.of("name", "Host", "personRoles", List.of("HOST")));
        var series = series(record("tournaments", tournament("Hosted")));
        series.put("broadcast", List.of(Map.of("pageId", host, "role", "HOST")));
        record("series", series);

        var refused = editor(post(ROOT + "/admin/pages/" + host + "/delete"), Map.of("version", 0), 409);

        assertThat(refused.path("code").asString()).isEqualTo("PAGE_CONFLICT");
    }

    @Test
    void aCompetitionSnapshotResolvesItsPeopleAndMatchMvpsAndAPlanSaveKeepsThem() throws Exception {
        String a = record("teams", Map.of("code", code("first"), "name", "First"));
        String b = record("teams", Map.of("code", code("second"), "name", "Second"));
        String mvp = record("players", Map.of("code", code("mvp"), "nickname", "Planned MVP"));
        String caster = page("PERSON", Map.of("name", "Draft caster", "personRoles", List.of("CASTER")));
        var tournament = tournament("Planned");
        tournament.put("broadcast", List.of(Map.of("pageId", caster, "role", "CASTER")));
        String id = record("tournaments", tournament);
        var plan = new HashMap<String, Object>();
        plan.put("sourceUrl", "https://example.com/rules");
        plan.put("entrants", List.of(Map.of("teamId", a, "status", "REGISTERED"),
                Map.of("teamId", b, "status", "REGISTERED")));
        plan.put("stages", List.of(Map.of("code", "GROUP", "name", "Group", "format", "ROUND_ROBIN", "bestOf", 3,
                "legs", 1, "winPoints", 1, "lossPoints", 0, "advance", 1)));
        plan.put("matches", editor(post(ADMIN + "/competitions/preview"),
                Map.of("content", plan, "stageCode", "GROUP", "opponent", 2), 200));
        var saved = editor(put(ADMIN + "/competitions/" + id), Map.of("version", 0, "content", plan), 200);
        var materialized = editor(post(ADMIN + "/competitions/" + id + "/materialize"),
                Map.of("version", saved.path("version").asLong()), 200);
        String seriesId = materialized.path("content").path("plan").path("matches").get(0).path("seriesId").asString();
        var match = editor(get(ADMIN + "/series/" + seriesId), null, 200);
        var linked = json.convertValue(match.path("content"), Map.class);
        linked.put("mvpPlayerId", mvp);
        linked.put("broadcast", List.of(Map.of("pageId", caster, "role", "CASTER")));
        editor(put(ADMIN + "/series/" + seriesId),
                Map.of("version", match.path("version").asLong(), "content", linked), 200);
        var replanned = json.convertValue(materialized.path("content").path("plan"), Map.class);
        @SuppressWarnings("unchecked")
        var matches = new ArrayList<Map<String, Object>>((List<Map<String, Object>>) replanned.get("matches"));
        var moved = new HashMap<>(matches.get(0));
        moved.put("scheduledAt", "2026-12-24T12:00:00Z");
        matches.set(0, moved);
        replanned.put("matches", matches);

        var draft = editor(put(ADMIN + "/competitions/" + id),
                Map.of("version", materialized.path("version").asLong(), "content", replanned), 200);
        var kept = editor(get(ADMIN + "/series/" + seriesId), null, 200).path("content");

        var person = draft.path("content").path("people").path(caster);
        assertThat(person.path("name").asString()).isEqualTo("Draft caster");
        assertThat(person.path("published").asBoolean()).isFalse();
        assertThat(draft.path("content").path("players").path(mvp).path("nickname").asString())
                .isEqualTo("Planned MVP");
        assertThat(kept.path("mvpPlayerId").asString()).isEqualTo(mvp);
        assertThat(kept.path("broadcast").get(0).path("pageId").asString()).isEqualTo(caster);
    }

    @Test
    void linkReviewListsAGameNoteThatNamesAnMvpUntilTheGameLinksOne() throws Exception {
        var content = tournament("Far future");
        content.put("startsOn", "2999-12-31");
        String seriesId = record("series", series(record("tournaments", content)));
        var game = editor(post(ADMIN + "/games"), Map.of("content", Map.of("seriesId", seriesId, "number", 1,
                "region", "VN", "locale", "vi-VN", "sides", List.of(), "note", "Ghi chú. MVP: Zed")), 200);
        String gameId = game.path("id").asString();

        var listed = editor(get(ADMIN + "/link-review").param("kind", "GAME_MVP").param("size", "100"), null, 200);
        var facets = editor(get(ADMIN + "/link-review/facets"), null, 200);
        var linked = json.convertValue(game.path("content"), Map.class);
        linked.put("mvpPlayerId", record("players", Map.of("code", code("zed"), "nickname", "Zed")));
        editor(put(ADMIN + "/games/" + gameId), Map.of("version", game.path("version").asLong(), "content", linked),
                200);
        var after = editor(get(ADMIN + "/link-review").param("kind", "GAME_MVP").param("size", "100"), null, 200);

        var mention = find(listed.path("items"), gameId);
        assertThat(mention).isNotNull();
        assertThat(mention.path("text").asString()).isEqualTo("Zed");
        assertThat(mention.path("seriesId").asString()).isEqualTo(seriesId);
        assertThat(mention.path("label").asString()).isEqualTo("Team A vs Team B");
        assertThat(values(facets, "kind")).contains("GAME_MVP", "SERIES_BROADCAST", "AWARD_TEAM");
        assertThat(find(after.path("items"), gameId)).isNull();
    }

    @Test
    void aProfileHistoryEntryMustNameAnExistingTournamentAndPage() throws Exception {
        String tournament = record("tournaments", tournament("Career stop"));
        var unknownTournament = Map.of("name", "Player", "history",
                List.of(Map.of("title", "Somewhere", "tournamentId", UUID.randomUUID().toString())));
        var unknownPage = Map.of("name", "Player", "history",
                List.of(Map.of("title", "Somewhere", "relatedPageId", UUID.randomUUID().toString())));
        var known = Map.of("name", "Player", "history",
                List.of(Map.of("title", "Career stop", "tournamentId", tournament)));

        var refusedTournament = editor(post(ROOT + "/admin/pages"),
                Map.of("kind", "PLAYER", "code", code("history"), "content", unknownTournament), 422);
        var refusedPage = editor(post(ROOT + "/admin/pages"),
                Map.of("kind", "PLAYER", "code", code("history"), "content", unknownPage), 422);
        var saved = editor(post(ROOT + "/admin/pages"),
                Map.of("kind", "PLAYER", "code", code("history"), "content", known), 200);

        assertThat(refusedTournament.path("code").asString()).isEqualTo("PAGE_INVALID_CONTENT");
        assertThat(refusedPage.path("code").asString()).isEqualTo("PAGE_INVALID_CONTENT");
        assertThat(saved.path("content").path("history").get(0).path("tournamentId").asString()).isEqualTo(tournament);
    }

    @Test
    void onlyATeamNamesAnOwningOrganization() throws Exception {
        String organization = page("ORGANIZATION", Map.of("name", "Owner"));
        String person = page("PERSON", Map.of("name", "Not an owner", "personRoles", List.of("COACH")));

        var personWithOwner = editor(post(ROOT + "/admin/pages"), Map.of("kind", "PERSON", "code", code("person"),
                "content", Map.of("name", "Owned person", "personRoles", List.of("COACH"), "organizationId",
                        organization)),
                422);
        var ownedByPerson = editor(post(ROOT + "/admin/pages"), Map.of("kind", "TEAM", "code", code("team"),
                "content", Map.of("name", "Odd team", "organizationId", person)), 422);

        assertThat(personWithOwner.path("code").asString()).isEqualTo("PAGE_INVALID_CONTENT");
        assertThat(ownedByPerson.path("code").asString()).isEqualTo("PAGE_INVALID_CONTENT");
    }

    @Test
    void aTeamIsPublishedAfterItsOwnerAndListedUnderIt() throws Exception {
        var source = List.of(Map.of("label", "Source", "url", "https://example.com"));
        var owner = editor(post(ROOT + "/admin/pages"), Map.of("kind", "ORGANIZATION", "code", code("owner"),
                "content", Map.of("name", "Owner", "sources", source)), 200);
        String organization = owner.path("id").asString();
        var team = editor(post(ROOT + "/admin/pages"), Map.of("kind", "TEAM", "code", code("owned"), "content",
                Map.of("name", "Owned team", "sources", source, "organizationId", organization)), 200);
        String teamId = team.path("id").asString();

        var early = editor(post(ROOT + "/admin/pages/" + teamId + "/publish"), Map.of("version", 0), 409);
        editor(post(ROOT + "/admin/pages/" + organization + "/publish"), Map.of("version", 0), 200);
        editor(post(ROOT + "/admin/pages/" + teamId + "/publish"), Map.of("version", 0), 200);
        var listed = api.send(get(ROOT + "/pages").param("kind", "TEAM").param("organizationId", organization), null,
                200);

        assertThat(early.path("code").asString()).isEqualTo("PAGE_CONFLICT");
        assertThat(listed.path("totalElements").asInt()).isEqualTo(1);
        assertThat(listed.path("items").get(0).path("id").asString()).isEqualTo(teamId);
    }

    @Test
    void anOrganizationThatOwnsATeamKeepsItsDraftFromDeletion() throws Exception {
        String organization = page("ORGANIZATION", Map.of("name", "Owner"));
        page("TEAM", Map.of("name", "Owned team", "organizationId", organization));

        var refused = editor(post(ROOT + "/admin/pages/" + organization + "/delete"), Map.of("version", 0), 409);

        assertThat(refused.path("code").asString()).isEqualTo("PAGE_CONFLICT");
    }

    private JsonNode editor(MockHttpServletRequestBuilder request, Object body, int status) throws Exception {
        return api.send(ApiCalls.as(request, "links-editor", EDITOR), body, status);
    }

    private String record(String kind, Map<String, Object> content) throws Exception {
        return editor(post(ADMIN + "/" + kind), Map.of("content", content), 200).path("id").asString();
    }

    private String page(String kind, Map<String, Object> content) throws Exception {
        return editor(post(ROOT + "/admin/pages"), Map.of("kind", kind, "code", code(kind.toLowerCase()), "content",
                content), 200).path("id").asString();
    }

    private Map<String, Object> series(String tournamentId) throws Exception {
        var content = new HashMap<String, Object>();
        content.put("code", code("match"));
        content.put("tournamentId", tournamentId);
        content.put("teamAId", record("teams", Map.of("code", code("a"), "name", "Team A")));
        content.put("teamBId", record("teams", Map.of("code", code("b"), "name", "Team B")));
        content.put("bestOf", 3);
        content.put("repeatPicksAllowed", false);
        return content;
    }

    private static Map<String, Object> tournament(String name) {
        var content = new HashMap<String, Object>();
        content.put("code", code("event"));
        content.put("name", name);
        content.put("region", "VN");
        return content;
    }

    private static List<String> usageTypes(JsonNode impact) {
        return values(impact.path("usages"), "type");
    }

    private static List<String> values(JsonNode items, String field) {
        var values = new ArrayList<String>();
        items.forEach(item -> values.add(item.path(field).asString()));
        return values;
    }

    private static JsonNode find(JsonNode items, String recordId) {
        for (var item : items) {
            if (item.path("recordId").asString().equals(recordId)) {
                return item;
            }
        }
        return null;
    }

    private static String code(String prefix) {
        return prefix + "-" + UUID.randomUUID();
    }
}
