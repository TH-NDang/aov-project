package com.wikiaov.community.tournament.internal.web;

import static com.wikiaov.community.testsupport.ApiCalls.ROOT;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.anyBoolean;
import static org.mockito.Mockito.anyString;
import static org.mockito.Mockito.nullable;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.community.testsupport.ApiCalls;
import com.wikiaov.community.testsupport.CommunityApplicationTest;
import com.wikiaov.community.testsupport.CompetitionFixture;
import com.wikiaov.community.tournament.internal.catalog.application.WikiCatalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Catalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Reference;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.ResolvedContext;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Who picked, banned and built what in the published games of a competition (spec 04). */
@CommunityApplicationTest
class CompetitionLineupsApiIntegrationTest {
    private static final Map<String, String> FLORENTINO = selection("Florentino");
    private static final Map<String, String> VEERA = selection("Veera");
    private static final Map<String, String> FLICKER = selection("Flicker");
    private static final Map<String, String> COURAGE = selection("Courage");
    private static final Map<String, String> BLADE = selection("Blade");

    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @MockitoBean
    WikiCatalog catalog;
    @MockitoBean
    JwtDecoder decoder;

    private ApiCalls api;

    @BeforeEach
    void calls() {
        api = new ApiCalls(mvc, json);
        var context = new ResolvedContext("VN", "vi-VN", UUID.randomUUID(), null, null, null, null, null, true, false);
        when(catalog.read(anyString(), anyString(), nullable(UUID.class), nullable(UUID.class), anyBoolean()))
                .thenReturn(new Catalog(List.of(reference(FLORENTINO, null), reference(VEERA, null)),
                        List.of(reference(BLADE, 3)), List.of(), List.of(reference(COURAGE, 3)),
                        List.of(reference(FLICKER, null)), context));
    }

    @Test
    void aGameComesWithItsMatchItsTeamsItsPicksAndItsBans() throws Exception {
        var competition = CompetitionFixture.published(api);
        String id = competition.game().pick("BLUE", 2, FLORENTINO).ban("RED", 0, VEERA).wonBy("BLUE").lasting(941)
                .mvp(competition.player("BLUE", 2)).publish();

        var lineups = lineups(competition);

        var game = lineups.path("games").get(0);
        assertThat(game.path("id").asString()).isEqualTo(id);
        assertThat(game.path("seriesId").asString()).isEqualTo(competition.seriesId());
        assertThat(game.path("number").asInt()).isEqualTo(1);
        assertThat(game.path("winner").asString()).isEqualTo("BLUE");
        assertThat(game.path("seconds").asInt()).isEqualTo(941);
        assertThat(game.path("blue").path("teamId").asString()).isEqualTo(competition.team("BLUE"));
        assertThat(game.path("red").path("teamId").asString()).isEqualTo(competition.team("RED"));
        assertThat(player(lineups, game.path("mvp"))).isEqualTo(competition.player("BLUE", 2));
        var pick = game.path("blue").path("picks").get(2);
        assertThat(hero(lineups, pick)).isEqualTo("Florentino");
        assertThat(pick.path("lane").asString()).isEqualTo("MID");
        assertThat(player(lineups, pick.path("player"))).isEqualTo(competition.player("BLUE", 2));
        assertThat(lineups.path("players").get(pick.path("player").asInt()).path("name").asString())
                .startsWith("MID");
        assertThat(game.path("red").path("bans")).hasSize(4)
                .anySatisfy(ban -> assertThat(hero(lineups, ban)).isEqualTo("Veera"));
    }

    @Test
    void aRecordedDraftGivesPicksAndBansTheirTurn() throws Exception {
        var competition = CompetitionFixture.published(api);
        competition.game().pick("RED", 0, FLORENTINO).ban("BLUE", 0, VEERA).drafted().publish();

        var lineups = lineups(competition);

        var game = lineups.path("games").get(0);
        assertThat(game.path("blue").path("bans").get(0).path("turn").asInt()).isEqualTo(1);
        assertThat(hero(lineups, game.path("blue").path("bans").get(0))).isEqualTo("Veera");
        assertThat(game.path("red").path("picks").get(0).path("turn").asInt()).isEqualTo(10);
    }

    @Test
    void whatIsNotKnownOfAGameIsLeftOut() throws Exception {
        var competition = CompetitionFixture.published(api);
        competition.game().publish();

        mvc.perform(get(path(competition))).andExpect(jsonPath("$.games[0].winner").doesNotHaveJsonPath())
                .andExpect(jsonPath("$.games[0].seconds").doesNotHaveJsonPath())
                .andExpect(jsonPath("$.games[0].mvp").doesNotHaveJsonPath())
                .andExpect(jsonPath("$.games[0].blue.picks[0].turn").doesNotHaveJsonPath());
    }

    @Test
    void draftsAndWithdrawnGamesAreNotListed() throws Exception {
        var competition = CompetitionFixture.published(api);
        String listed = competition.game().publish();
        String withdrawn = competition.game().publish();
        competition.game().save();

        competition.withdrawGame(withdrawn);

        var games = lineups(competition).path("games");
        assertThat(games).hasSize(1);
        assertThat(games.get(0).path("id").asString()).isEqualTo(listed);
    }

    @Test
    void theGamesOfAnotherCompetitionAreNotListed() throws Exception {
        var competition = CompetitionFixture.published(api);
        competition.game().publish();
        CompetitionFixture.published(api).game().publish();

        assertThat(lineups(competition).path("games")).hasSize(1);
    }

    @Test
    void aCompetitionWithoutPublishedGamesListsNothing() throws Exception {
        mvc.perform(get(path(CompetitionFixture.published(api)))).andExpect(status().isOk())
                .andExpect(jsonPath("$.heroes").isEmpty()).andExpect(jsonPath("$.players").isEmpty())
                .andExpect(jsonPath("$.games").isEmpty());
    }

    @Test
    void aCompetitionThatWasNeverPublishedIsNotFound() throws Exception {
        mvc.perform(get(path(CompetitionFixture.draft(api)))).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TOURNAMENT_RECORD_NOT_FOUND"));
    }

    @Test
    void unchangedLineupsAreAnsweredWithNotModified() throws Exception {
        var competition = CompetitionFixture.published(api);
        competition.game().publish();
        mvc.perform(get(path(competition)))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "max-age=300, public"));
        var tag = tag(competition);

        mvc.perform(get(path(competition)).header(HttpHeaders.IF_NONE_MATCH, tag))
                .andExpect(status().isNotModified());
    }

    @Test
    void aPublishedGameChangesTheTagOfItsCompetition() throws Exception {
        var competition = CompetitionFixture.published(api);
        var tag = tag(competition);

        competition.game().publish();

        mvc.perform(get(path(competition)).header(HttpHeaders.IF_NONE_MATCH, tag)).andExpect(status().isOk());
    }

    @Test
    void anUnknownParameterIsRefused() throws Exception {
        mvc.perform(get(path(CompetitionFixture.published(api))).param("stage", "GROUP"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"));
    }

    @Test
    void theBuildsOfAHeroNameItsSpellItsMainEnchantmentAndItsLastItems() throws Exception {
        var competition = CompetitionFixture.published(api);
        String id = competition.game().lasting(900).pick("RED", 1, FLORENTINO)
                .seen("RED", 1, Map.of("spell", FLICKER, "enchantments", enchantment(COURAGE), "equipmentSnapshots",
                        List.of(inventory(300, "Early item"), inventory(890, "Blade"))))
                .publish();

        var builds = builds(competition, FLORENTINO);

        assertThat(builds.path("spells").get(0).path("name").asString()).isEqualTo("Flicker");
        assertThat(builds.path("spells").get(0).path("iconUrl").asString()).isEqualTo("https://img/Flicker.png");
        assertThat(builds.path("enchantments").get(0).path("name").asString()).isEqualTo("Courage");
        assertThat(builds.path("items")).hasSize(1);
        assertThat(builds.path("items").get(0).path("name").asString()).isEqualTo("Blade");
        assertThat(builds.path("builds").get(0).path("gameId").asString()).isEqualTo(id);
        assertThat(builds.path("builds").get(0).path("items").get(0).asInt()).isZero();
    }

    @Test
    void aBuildThatWasWrittenDownTellsWhatBecameOfEachItem() throws Exception {
        var competition = CompetitionFixture.published(api);
        competition.game().pick("RED", 1, FLORENTINO)
                .seen("RED", 1, Map.of("equipmentSnapshots", List.of(inventory(300, "Early item")), "build",
                        List.of(Map.of("item", Map.of("name", "Boots"), "role", "CORE"),
                                Map.of("item", BLADE, "role", "CORE"),
                                Map.of("item", Map.of("name", "Revive"), "role", "PROTECTIVE", "replaces",
                                        List.of(Map.of("name", "Boots"))))))
                .publish();

        var builds = builds(competition, FLORENTINO);
        var build = builds.path("builds").get(0);

        assertThat(builds.path("items").findValuesAsString("name")).containsExactly("Boots", "Blade", "Revive");
        assertThat(builds.path("items").get(1).path("tier").asInt()).isEqualTo(3);
        assertThat(build.path("items")).hasToString("[0,1]");
        assertThat(build.path("protective")).hasToString("[2]");
        assertThat(build.path("sold")).hasToString("[0]");
    }

    @Test
    void aHeroNobodyPlayedHasNoBuilds() throws Exception {
        var competition = CompetitionFixture.published(api);
        competition.game().publish();

        var builds = builds(competition, VEERA);

        assertThat(builds.path("builds")).isEmpty();
        assertThat(builds.path("items")).isEmpty();
    }

    @Test
    void theBuildsOfACompetitionThatWasNeverPublishedAreNotFound() throws Exception {
        mvc.perform(get(buildsPath(CompetitionFixture.draft(api), FLORENTINO))).andExpect(status().isNotFound());
    }

    private static Map<String, String> selection(String name) {
        return Map.of("id", UUID.randomUUID().toString(), "name", name);
    }

    private static Reference reference(Map<String, String> selection, Integer tier) {
        return new Reference(UUID.fromString(selection.get("id")), "code-" + selection.get("id"),
                selection.get("name"), "https://img/" + selection.get("name") + ".png", tier, null,
                tier == null ? null : "branch", null);
    }

    private static Map<String, Object> enchantment(Map<String, String> selection) {
        return Map.of("status", "PARTIAL", "entries", List
                .of(Map.of("selection", selection, "primary", true, "tier", 3, "branchCode", "branch")));
    }

    /** An inventory whose first slot holds an item of the catalog, or one known by its name alone. */
    private static Map<String, Object> inventory(int atSeconds, String item) {
        var slots = new ArrayList<Map<String, Object>>();
        var first = new HashMap<String, Object>(Map.of("slot", 1, "known", true));
        first.put("item", item.equals("Blade") ? BLADE : Map.of("name", item));
        slots.add(first);
        for (int slot = 2; slot <= 6; slot++) {
            slots.add(Map.of("slot", slot, "known", false));
        }

        return Map.of("atSeconds", atSeconds, "slots", slots);
    }

    private static String path(CompetitionFixture competition) {
        return ROOT + "/competitions/" + competition.id() + "/lineups";
    }

    private static String buildsPath(CompetitionFixture competition, Map<String, String> hero) {
        return ROOT + "/competitions/" + competition.id() + "/heroes/" + hero.get("id") + "/builds";
    }

    private String tag(CompetitionFixture competition) throws Exception {
        return mvc.perform(get(path(competition))).andExpect(status().isOk()).andReturn().getResponse()
                .getHeader(HttpHeaders.ETAG);
    }

    private JsonNode lineups(CompetitionFixture competition) throws Exception {
        return read(path(competition));
    }

    private JsonNode builds(CompetitionFixture competition, Map<String, String> hero) throws Exception {
        return read(buildsPath(competition, hero));
    }

    private JsonNode read(String path) throws Exception {
        return json.readTree(mvc.perform(get(path)).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8));
    }

    private static String hero(JsonNode lineups, JsonNode pickOrBan) {
        return lineups.path("heroes").get(pickOrBan.path("hero").asInt()).path("name").asString();
    }

    private static String player(JsonNode lineups, JsonNode place) {
        return lineups.path("players").get(place.asInt()).path("id").asString();
    }
}
