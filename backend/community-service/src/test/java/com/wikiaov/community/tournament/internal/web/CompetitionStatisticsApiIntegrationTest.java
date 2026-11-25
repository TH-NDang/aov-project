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
import java.time.Instant;
import java.util.ArrayList;
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
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** What the published games of a competition add up to, and finding them by hero (spec 04). */
@CommunityApplicationTest
class CompetitionStatisticsApiIntegrationTest {
    private static final UUID FLORENTINO_ID = UUID.randomUUID();
    private static final Map<String, String> FLORENTINO = Map.of("id", FLORENTINO_ID.toString(), "name",
            "Florentino");
    /** A hero the wiki does not know, recorded as the broadcast names it. */
    private static final Map<String, String> NEWCOMER = Map.of("name", "Newcomer");

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
        catalogNames("Florentino");
    }

    @Test
    void theGamesOfACompetitionAreCountedWithTheirWinners() throws Exception {
        var competition = CompetitionFixture.published(api);
        competition.game().wonBy("BLUE").publish();
        competition.game().wonBy("BLUE").publish();
        competition.game().wonBy("RED").publish();
        competition.game().publish();

        var statistics = statistics(competition);

        assertThat(statistics.path("games").asInt()).isEqualTo(4);
        assertThat(statistics.path("decided").asInt()).isEqualTo(3);
        assertThat(statistics.path("blueWins").asInt()).isEqualTo(2);
    }

    @Test
    void theLengthsAreThoseOfTheGamesThatHaveOne() throws Exception {
        var competition = CompetitionFixture.published(api);
        String longest = competition.game().lasting(2210).publish();
        String shortest = competition.game().lasting(502).publish();
        competition.game().lasting(1000).publish();
        competition.game().publish();

        var statistics = statistics(competition);

        assertThat(statistics.path("averageSeconds").asInt()).isEqualTo(1237);
        assertThat(statistics.path("longest").path("id").asString()).isEqualTo(longest);
        assertThat(statistics.path("longest").path("seconds").asInt()).isEqualTo(2210);
        assertThat(statistics.path("shortest").path("id").asString()).isEqualTo(shortest);
        assertThat(statistics.path("shortest").path("seconds").asInt()).isEqualTo(502);
    }

    @Test
    void aHeroCountsItsPicksItsWinsItsBansAndItsPicksOnTheBlueSide() throws Exception {
        var competition = CompetitionFixture.published(api);
        competition.game().pick("BLUE", 0, FLORENTINO).wonBy("BLUE").publish();
        competition.game().pick("RED", 2, FLORENTINO).wonBy("BLUE").publish();
        competition.game().pick("RED", 0, FLORENTINO).publish();
        competition.game().ban("RED", 1, FLORENTINO).wonBy("RED").publish();

        var hero = hero(statistics(competition), "Florentino");

        assertThat(hero.path("id").asString()).isEqualTo(FLORENTINO_ID.toString());
        assertThat(hero.path("picks").asInt()).isEqualTo(3);
        assertThat(hero.path("wins").asInt()).isEqualTo(1);
        assertThat(hero.path("bans").asInt()).isEqualTo(1);
        assertThat(hero.path("bluePicks").asInt()).isEqualTo(1);
    }

    @Test
    void aHeroRecordedWithoutAnIdIsCountedByItsName() throws Exception {
        var competition = CompetitionFixture.published(api);
        competition.game().pick("BLUE", 0, NEWCOMER).publish();
        competition.game().ban("BLUE", 0, NEWCOMER).publish();

        var hero = hero(statistics(competition), "Newcomer");

        assertThat(hero.has("id")).isFalse();
        assertThat(hero.path("picks").asInt()).isEqualTo(1);
        assertThat(hero.path("bans").asInt()).isEqualTo(1);
    }

    @Test
    void aHeroIsNamedAsInTheNewestPublishedGame() throws Exception {
        var competition = CompetitionFixture.published(api);
        competition.game().pick("BLUE", 0, FLORENTINO).publish();
        catalogNames("Florentino the Duelist");
        competition.game().pick("BLUE", 0, FLORENTINO).publish();

        var statistics = statistics(competition);

        assertThat(hero(statistics, "Florentino the Duelist").path("picks").asInt()).isEqualTo(2);
    }

    @Test
    void theHeroesMostPickedAndBannedComeFirst() throws Exception {
        var competition = CompetitionFixture.published(api);
        competition.game().pick("BLUE", 0, FLORENTINO).ban("RED", 0, NEWCOMER).publish();
        competition.game().ban("BLUE", 0, FLORENTINO).pick("RED", 0, NEWCOMER).publish();
        competition.game().pick("RED", 0, FLORENTINO).pick("BLUE", 0, NEWCOMER).publish();
        competition.game().pick("RED", 0, FLORENTINO).publish();

        var heroes = statistics(competition).path("heroes");

        assertThat(heroes.get(0).path("name").asString()).isEqualTo("Florentino");
        assertThat(heroes.get(1).path("name").asString()).isEqualTo("Newcomer");
    }

    @Test
    void thePlayerNamedMvpMostOftenComesFirst() throws Exception {
        var competition = CompetitionFixture.published(api);
        competition.game().mvp(competition.player("RED", 1)).publish();
        competition.game().mvp(competition.player("BLUE", 2)).publish();
        competition.game().mvp(competition.player("BLUE", 2)).publish();

        var mvps = statistics(competition).path("mvps");

        assertThat(mvps).hasSize(2);
        assertThat(mvps.get(0).path("playerId").asString()).isEqualTo(competition.player("BLUE", 2));
        assertThat(mvps.get(0).path("games").asInt()).isEqualTo(2);
        assertThat(mvps.get(1).path("playerId").asString()).isEqualTo(competition.player("RED", 1));
    }

    @Test
    void aGameThatIsOnlyADraftIsNotCounted() throws Exception {
        var competition = CompetitionFixture.published(api);
        competition.game().publish();
        competition.game().save();

        assertThat(statistics(competition).path("games").asInt()).isEqualTo(1);
    }

    @Test
    void aWithdrawnGameLeavesTheCount() throws Exception {
        var competition = CompetitionFixture.published(api);
        competition.game().wonBy("BLUE").publish();
        String withdrawn = competition.game().pick("BLUE", 0, FLORENTINO).wonBy("BLUE").publish();
        assertThat(statistics(competition).path("games").asInt()).isEqualTo(2);

        competition.withdrawGame(withdrawn);

        var statistics = statistics(competition);
        assertThat(statistics.path("games").asInt()).isEqualTo(1);
        assertThat(statistics.path("blueWins").asInt()).isEqualTo(1);
        assertThat(hero(statistics, "Florentino")).isNull();
    }

    @Test
    void theGamesOfAnotherCompetitionAreNotCounted() throws Exception {
        var competition = CompetitionFixture.published(api);
        var other = CompetitionFixture.published(api);
        competition.game().publish();
        other.game().publish();

        assertThat(statistics(competition).path("games").asInt()).isEqualTo(1);
    }

    @Test
    void aCompetitionWithoutPublishedGamesAddsUpToNothing() throws Exception {
        var competition = CompetitionFixture.published(api);

        request(competition).andExpect(status().isOk()).andExpect(jsonPath("$.games").value(0))
                .andExpect(jsonPath("$.decided").value(0)).andExpect(jsonPath("$.blueWins").value(0))
                .andExpect(jsonPath("$.averageSeconds").doesNotHaveJsonPath())
                .andExpect(jsonPath("$.longest").doesNotHaveJsonPath())
                .andExpect(jsonPath("$.shortest").doesNotHaveJsonPath())
                .andExpect(jsonPath("$.heroes").isEmpty()).andExpect(jsonPath("$.mvps").isEmpty());
    }

    @Test
    void aCompetitionThatWasNeverPublishedIsNotFound() throws Exception {
        var competition = CompetitionFixture.draft(api);
        competition.game().publish();

        request(competition).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TOURNAMENT_RECORD_NOT_FOUND"));
    }

    @Test
    void aWithdrawnCompetitionIsNotFoundEvenByABrowserThatStillHoldsItsTag() throws Exception {
        var competition = CompetitionFixture.published(api);
        var tag = tag(competition);

        competition.withdraw();

        mvc.perform(get(path(competition)).header(HttpHeaders.IF_NONE_MATCH, tag)).andExpect(status().isNotFound());
    }

    @Test
    void unchangedStatisticsAreAnsweredWithNotModified() throws Exception {
        var competition = CompetitionFixture.published(api);
        competition.game().publish();
        request(competition).andExpect(header().string(HttpHeaders.CACHE_CONTROL, "max-age=300, public"));
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
    void aGamePublishedInAnotherCompetitionLeavesTheTagAlone() throws Exception {
        var competition = CompetitionFixture.published(api);
        competition.game().publish();
        var tag = tag(competition);

        CompetitionFixture.published(api).game().publish();

        assertThat(tag(competition)).isEqualTo(tag);
    }

    @Test
    void anUnknownParameterIsRefused() throws Exception {
        var competition = CompetitionFixture.published(api);

        mvc.perform(get(path(competition)).param("stage", "GROUP")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"));
    }

    @Test
    void publishedGamesAreFoundByAHeroThatWasPicked() throws Exception {
        var competition = CompetitionFixture.published(api);
        String blue = competition.game().pick("BLUE", 4, FLORENTINO).publish();
        competition.game().ban("BLUE", 0, FLORENTINO).publish();
        String red = competition.game().pick("RED", 0, FLORENTINO).publish();
        competition.game().pick("RED", 0, FLORENTINO).save();

        mvc.perform(get(ROOT + "/games").param("tournamentId", competition.id())
                .param("heroId", FLORENTINO_ID.toString())).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.items[0].id").value(red))
                .andExpect(jsonPath("$.items[1].id").value(blue));
    }

    @Test
    void theGamesOfTheLatestMatchComeFirstInWhateverOrderTheyWerePublished() throws Exception {
        var competition = CompetitionFixture.published(api);
        String later = competition.series(Instant.parse("2026-10-25T07:00:00Z"));
        String earlier = competition.series(Instant.parse("2026-10-24T07:00:00Z"));
        String last = competition.game(later, 2).publish();
        String first = competition.game(later, 1).publish();
        String dayBefore = competition.game(earlier, 1).publish();
        String unscheduled = competition.game().publish();

        mvc.perform(get(ROOT + "/games").param("tournamentId", competition.id())).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(last)).andExpect(jsonPath("$.items[1].id").value(first))
                .andExpect(jsonPath("$.items[2].id").value(dayBefore))
                .andExpect(jsonPath("$.items[3].id").value(unscheduled));
    }

    @Test
    void aHeroIsLookedForInsideTheMatchAskedFor() throws Exception {
        var competition = CompetitionFixture.published(api);
        String match = competition.series();
        competition.game().pick("BLUE", 0, FLORENTINO).publish();
        String wanted = competition.game(match, 1).pick("BLUE", 0, FLORENTINO).publish();
        competition.game(match, 2).publish();

        mvc.perform(get(ROOT + "/games").param("seriesId", match).param("heroId", FLORENTINO_ID.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(wanted));
    }

    @Test
    void aHeroIsLookedForInEveryCompetitionWhenNoneIsNamed() throws Exception {
        var hero = Map.of("id", UUID.randomUUID().toString(), "name", "Only here");
        catalogNames("Florentino", hero);
        String first = CompetitionFixture.published(api).game().pick("BLUE", 0, hero).publish();
        String second = CompetitionFixture.published(api).game().pick("RED", 0, hero).publish();

        mvc.perform(get(ROOT + "/games").param("heroId", hero.get("id")).param("size", "1").param("page", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].id").value(first));
        mvc.perform(get(ROOT + "/games").param("heroId", hero.get("id")).param("size", "1"))
                .andExpect(jsonPath("$.items[0].id").value(second));
    }

    @Test
    void aHeroThatIsNotAnIdIsRefused() throws Exception {
        mvc.perform(get(ROOT + "/games").param("heroId", "florentino")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"));
    }

    /** The wiki knows Florentino, by {@code name}, and the heroes given besides. */
    @SafeVarargs
    private void catalogNames(String name, Map<String, String>... others) {
        var heroes = new ArrayList<>(List.of(reference(FLORENTINO_ID.toString(), name)));
        for (var other : others) {
            heroes.add(reference(other.get("id"), other.get("name")));
        }
        var context = new ResolvedContext("VN", "vi-VN", UUID.randomUUID(), null, null, null, null, null, true, false);

        when(catalog.read(anyString(), anyString(), nullable(UUID.class), nullable(UUID.class), anyBoolean()))
                .thenReturn(new Catalog(heroes, List.of(), List.of(), List.of(), List.of(), context));
    }

    private static Reference reference(String id, String name) {
        return new Reference(UUID.fromString(id), "hero-" + id, name, null, null, null, null, null);
    }

    private static String path(CompetitionFixture competition) {
        return ROOT + "/competitions/" + competition.id() + "/statistics";
    }

    private ResultActions request(CompetitionFixture competition) throws Exception {
        return mvc.perform(get(path(competition)));
    }

    private String tag(CompetitionFixture competition) throws Exception {
        return request(competition).andExpect(status().isOk()).andReturn().getResponse().getHeader(HttpHeaders.ETAG);
    }

    private JsonNode statistics(CompetitionFixture competition) throws Exception {
        return json.readTree(request(competition).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8));
    }

    /** The count of a hero by its name, or null when the statistics do not name it. */
    private static JsonNode hero(JsonNode statistics, String name) {
        for (var hero : statistics.path("heroes")) {
            if (hero.path("name").asString().equals(name)) {
                return hero;
            }
        }
        return null;
    }
}
