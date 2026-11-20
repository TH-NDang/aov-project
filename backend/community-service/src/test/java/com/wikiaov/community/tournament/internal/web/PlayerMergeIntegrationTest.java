package com.wikiaov.community.tournament.internal.web;

import static com.wikiaov.community.testsupport.ApiCalls.ADMIN;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.anyBoolean;
import static org.mockito.Mockito.anyString;
import static org.mockito.Mockito.nullable;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.wikiaov.community.testsupport.ApiCalls;
import com.wikiaov.community.testsupport.CommunityApplicationTest;
import com.wikiaov.community.tournament.internal.catalog.application.WikiCatalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Catalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.ResolvedContext;
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

/** Players with the same name and merging two profiles of one person (spec 04). */
@CommunityApplicationTest
class PlayerMergeIntegrationTest {
    private static final String[] EDITOR = {"tournament:read", "tournament:write"};
    private static final List<String> LANES = List.of("TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT");

    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @MockitoBean
    JwtDecoder decoder;
    @MockitoBean
    WikiCatalog catalog;

    private ApiCalls api;

    @BeforeEach
    void calls() {
        api = new ApiCalls(mvc, json);
        when(catalog.read(anyString(), anyString(), nullable(UUID.class), nullable(UUID.class), anyBoolean()))
                .thenReturn(new Catalog(List.of(), List.of(), List.of(), List.of(), List.of(), new ResolvedContext("VN",
                        "vi-VN", UUID.randomUUID(), null, null, null, null, null, true, false)));
    }

    @Test
    void aNewPlayerNamedLikeAnActivePlayerOfTheSameCountryIsRefusedUntilANamesakeIsConfirmed() throws Exception {
        String name = "Anh Duy " + UUID.randomUUID().toString().substring(0, 8);
        String existing = player(name, "VN");
        var spelledTogether = playerContent(name.replace(" ", ""), "VN");

        var refused = editor(post(ADMIN + "/players"), Map.of("content", spelledTogether), 409);
        editor(post(ADMIN + "/players"), Map.of("content", playerContent(name, "TH")), 200);
        editor(post(ADMIN + "/players").param("allowSameName", "true"), Map.of("content", spelledTogether), 200);

        assertThat(refused.path("code").asString()).isEqualTo("TOURNAMENT_PLAYER_SAME_NAME");
        assertThat(refused.path("players").get(0).path("id").asString()).isEqualTo(existing);
    }

    @Test
    void aNewPlayerPageForAnExistingPlayerNameIsRefusedUntilANamesakeIsConfirmed() throws Exception {
        String name = "Bánh Bao " + suffix();
        player(name, "VN");
        var page = Map.of("kind", "PLAYER", "code", code("page"), "content",
                Map.of("name", name.replace(" ", ""), "country", "VN"));

        var refused = editor(post(ApiCalls.ROOT + "/admin/pages"), page, 409);
        editor(post(ApiCalls.ROOT + "/admin/pages").param("allowSameName", "true"), page, 200);

        assertThat(refused.path("code").asString()).isEqualTo("TOURNAMENT_PLAYER_SAME_NAME");
    }

    @Test
    void mergingMovesRosterLinesSeatsMvpsAndAwardsAndTrashesTheMergedProfile() throws Exception {
        String kept = player("Kiral " + suffix(), "VN");
        String merged = player("KiraL " + suffix(), "VN", "allowSameName");
        String tournament = record("tournaments", tournament());
        var series = series(tournament);
        String seriesId = record("series", series);
        String shared = roster(tournament, (String) series.get("teamAId"), kept);
        String repeated = roster(tournament, (String) series.get("teamAId"), merged);
        String other = record("tournaments", tournament());
        String moved = roster(other, (String) series.get("teamBId"), merged);
        String gameId = game(seriesId, series, merged);
        award(tournament, merged);
        mvp(seriesId, merged);

        var result = editor(post(ADMIN + "/players/" + merged + "/merge"), Map.of("version", version("players", merged),
                "intoId", kept, "intoVersion", version("players", kept)), 200);

        assertThat(result.path("player").path("content").path("aliases").toString()).contains("KiraL");
        assertThat(result.path("moved").path("rosterLines").asInt()).isEqualTo(1);
        assertThat(result.path("moved").path("repeatedRosterLines").asInt()).isEqualTo(1);
        assertThat(read("players", merged).path("deletedAt").isNull()).isFalse();
        assertThat(read("roster-memberships", moved).path("content").path("playerId").asString()).isEqualTo(kept);
        assertThat(read("roster-memberships", repeated).path("deletedAt").isNull()).isFalse();
        assertThat(read("roster-memberships", shared).path("deletedAt").isNull()).isTrue();
        assertThat(read("games", gameId).path("content").toString()).contains(kept).doesNotContain(merged);
        assertThat(read("series", seriesId).path("content").path("mvpPlayerId").asString()).isEqualTo(kept);
        assertThat(read("tournaments", tournament).path("content").path("awards").get(0).path("playerId")
                .asString()).isEqualTo(kept);
    }

    @Test
    void twoProfilesSeatedInTheSameGameAreTwoPeopleAndAreNotMerged() throws Exception {
        String first = player("Sun " + suffix(), "VN");
        String second = player("Sun " + suffix(), "VN");
        String tournament = record("tournaments", tournament());
        var series = series(tournament);
        String seriesId = record("series", series);
        game(seriesId, series, first, second);

        var refused = editor(post(ADMIN + "/players/" + second + "/merge"), Map.of("version", version("players",
                second), "intoId", first, "intoVersion", version("players", first)), 400);

        assertThat(refused.path("code").asString()).isEqualTo("TOURNAMENT_INVALID_CONTENT");
        assertThat(read("players", second).path("deletedAt").isNull()).isTrue();
    }

    private String player(String nickname, String country, String... flags) throws Exception {
        var request = post(ADMIN + "/players");
        for (var flag : flags) {
            request.param(flag, "true");
        }
        return editor(request, Map.of("content", playerContent(nickname, country)), 200).path("id").asString();
    }

    private static Map<String, Object> playerContent(String nickname, String country) {
        return Map.of("code", code("player"), "nickname", nickname, "country", country);
    }

    private String roster(String tournament, String team, String player) throws Exception {
        return record("roster-memberships", Map.of("tournamentId", tournament, "teamId", team, "playerId", player));
    }

    /** One game whose blue side seats {@code seated} and fills the other places with new players. */
    private String game(String seriesId, Map<String, Object> series, String... seated) throws Exception {
        var sides = new ArrayList<Map<String, Object>>();
        int hero = 0;
        int next = 0;
        for (var side : List.of("BLUE", "RED")) {
            var participants = new ArrayList<Map<String, Object>>();
            for (var lane : LANES) {
                String player = side.equals("BLUE") && next < seated.length
                        ? seated[next++]
                        : player("Filler " + suffix(), "XK");
                participants.add(Map.of("playerId", player, "lane", lane, "hero", Map.of("name", "Hero " + hero++)));
            }
            sides.add(Map.of("side", side, "teamId", series.get(side.equals("BLUE") ? "teamAId" : "teamBId"),
                    "bans", List.of(), "participants", participants));
        }
        return record("games", Map.of("seriesId", seriesId, "number", 1, "region", "VN", "locale", "vi-VN",
                "sides", sides));
    }

    private void award(String tournament, String player) throws Exception {
        var content = content("tournaments", tournament);
        content.put("awards", List.of(Map.of("title", "MVP", "playerId", player, "recipientName", "KiraL")));
        editor(put(ADMIN + "/tournaments/"
                + tournament), Map.of("version", version("tournaments", tournament), "content", content), 200);
    }

    private void mvp(String seriesId, String player) throws Exception {
        var content = content("series", seriesId);
        content.put("mvpPlayerId", player);
        editor(put(ADMIN + "/series/" + seriesId),
                Map.of("version", version("series", seriesId), "content", content), 200);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> content(String kind, String id) throws Exception {
        return json.convertValue(read(kind, id).path("content"), HashMap.class);
    }

    private JsonNode read(String kind, String id) throws Exception {
        return editor(get(ADMIN + "/" + kind + "/" + id), null, 200);
    }

    private long version(String kind, String id) throws Exception {
        return read(kind, id).path("version").asLong();
    }

    private JsonNode editor(MockHttpServletRequestBuilder request, Object body, int status) throws Exception {
        return api.send(ApiCalls.as(request, "merge-editor", EDITOR), body, status);
    }

    private String record(String kind, Map<String, Object> content) throws Exception {
        return editor(post(ADMIN + "/" + kind), Map.of("content", content), 200).path("id").asString();
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

    private static Map<String, Object> tournament() {
        var content = new HashMap<String, Object>();
        content.put("code", code("event"));
        content.put("name", "Merge test");
        content.put("region", "VN");
        return content;
    }

    private static String suffix() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private static String code(String prefix) {
        return prefix + "-" + UUID.randomUUID();
    }
}
