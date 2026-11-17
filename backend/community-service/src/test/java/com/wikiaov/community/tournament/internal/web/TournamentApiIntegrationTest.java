package com.wikiaov.community.tournament.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.testsupport.CommunityApplicationTest;
import com.wikiaov.community.tournament.internal.application.SeriesRegistry;
import com.wikiaov.community.tournament.internal.application.TeamRegistry;
import com.wikiaov.community.tournament.internal.application.WikiCatalog;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.Action;
import com.wikiaov.community.tournament.internal.archive.application.RegistryArchivePolicy;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

@CommunityApplicationTest
class TournamentApiIntegrationTest {
    @Autowired
    PostgreSQLContainer database;
    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @Autowired
    TeamRegistry teamRegistry;
    @Autowired
    SeriesRegistry seriesRegistry;
    @Autowired
    RegistryArchivePolicy archivePolicy;
    @Autowired
    PlatformTransactionManager transactions;
    @MockitoBean
    WikiCatalog catalog;
    @MockitoBean
    JwtDecoder decoder;
    static final String ADMIN = "/api/community/v1/admin";
    static final String PUBLIC = "/api/community/v1";

    @BeforeEach
    void references() {
        when(catalog.read(anyString(), anyString(), nullable(UUID.class), nullable(UUID.class), anyBoolean()))
                .thenReturn(new Catalog(List.of(), List.of(), List.of(), List.of(), List.of(), new ResolvedContext("VN",
                        "vi-VN", UUID.randomUUID(), null, null, null, null, null, true, false)));
    }

    @Test
    void adminRequiresReadAndMutationRequiresIndependentWriteCapability() throws Exception {
        mvc.perform(get(ADMIN + "/teams")).andExpect(status().isUnauthorized());
        mvc.perform(get(ADMIN + "/teams").with(jwt().authorities(new SimpleGrantedAuthority("tournament:read"))))
                .andExpect(status().isOk());
        mvc.perform(post(ADMIN + "/teams").with(jwt().authorities(new SimpleGrantedAuthority("tournament:read")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":{\"code\":\"forbidden\",\"name\":\"Forbidden\"}}"))
                .andExpect(status().isForbidden());
        mvc.perform(get(PUBLIC + "/games?unexpected=true")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/community/v2/games")).andExpect(status().is4xxClientError());
    }

    @Test
    void aRequestWithoutATokenIsAnsweredWithAnUnauthenticatedProblem() throws Exception {
        mvc.perform(get(ADMIN + "/teams")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
                .andExpect(jsonPath("$.requestId").isNotEmpty()).andExpect(header().exists("WWW-Authenticate"));
    }

    @Test
    void aMissingCapabilityIsAnsweredWithAForbiddenProblem() throws Exception {
        mvc.perform(post(ADMIN + "/teams").with(jwt().authorities(new SimpleGrantedAuthority("tournament:read")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":{\"code\":\"forbidden\",\"name\":\"Forbidden\"}}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void aPageLargerThanTheRegistryLimitIsAnInvalidQueryParameter() throws Exception {
        mvc.perform(authorized(get(ADMIN + "/teams").param("size", "501"))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"))
                .andExpect(jsonPath("$.errors[0].path").value("size"));
    }

    @Test
    void theWholeRegistryPageIsServed() throws Exception {
        mvc.perform(authorized(get(ADMIN + "/teams").param("size", "500"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(500));
    }

    @Test
    void aSearchLongerThanTheLimitIsAnInvalidQueryParameter() throws Exception {
        mvc.perform(authorized(get(ADMIN + "/teams").param("q", "x".repeat(121)))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"));
    }

    @Test
    void aRequestBodyWithAnUnknownFieldIsRefusedWithItsPath() throws Exception {
        mvc.perform(authorized(post(ADMIN + "/teams")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":{\"code\":\"unknown-field\",\"name\":\"Unknown\",\"colour\":\"red\"}}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.errors[0].code").value("UNKNOWN_FIELD"))
                .andExpect(jsonPath("$.errors[0].path").value("content.colour"));
    }

    @Test
    void aRefusedRequestBodyStoresNothing() throws Exception {
        mvc.perform(authorized(post(ADMIN + "/teams")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":{\"code\":\"never-stored\",\"name\":\"Never\",\"colour\":\"red\"}}"))
                .andExpect(status().isBadRequest());

        mvc.perform(authorized(get(ADMIN + "/teams").param("q", "never-stored")))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void draftsStayPrivatePublicationFreezesMetadataAndWithdrawPreservesAudit() throws Exception {
        var fixture = fixture();
        var draft = create("games", fixture.game());
        String id = draft.get("id").toString();
        mvc.perform(get(PUBLIC + "/games/" + id)).andExpect(status().isNotFound());
        assertThat(((List<?>) draft.get("missingFields"))).isEmpty();

        var published = write(post(ADMIN + "/games/" + id + "/publish"), Map.of("version", version(draft)));
        mvc.perform(get(PUBLIC + "/games/" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.note").value("published observation"));
        mvc.perform(get(PUBLIC + "/games?seriesId=" + fixture.seriesId())).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get(PUBLIC + "/tournaments")).andExpect(status().isOk());
        mvc.perform(get(PUBLIC + "/series?tournamentId=" + fixture.tournamentId())).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));

        var changed = new Game(fixture.game().seriesId(), 1, "VN", "vi-VN", null, null, null, null, null, null, null,
                "draft edit", fixture.game().sides(), false);
        var updated = write(put(ADMIN + "/games/" + id), Map.of("version", version(published), "content", changed));
        mvc.perform(get(PUBLIC + "/games/" + id)).andExpect(jsonPath("$.content.note").value("published observation"));
        mvc.perform(authorized(put(ADMIN + "/games/" + id)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", version(published), "content", changed))))
                .andExpect(status().isConflict());

        write(post(ADMIN + "/games/" + id + "/withdraw"), Map.of("version", version(updated)));
        mvc.perform(get(PUBLIC + "/games/" + id)).andExpect(status().isNotFound());
        mvc.perform(get(PUBLIC + "/games?seriesId=" + fixture.seriesId()))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void timelineRoundTripsInDraftsIsValidatedAndIsFrozenWithThePublishedGame() throws Exception {
        var fixture = fixture();
        var draft = create("games", fixture.game());
        String id = draft.get("id").toString();
        var timeline = new GameTimeline(List.of(new VodPause(300, 90)),
                List.of(new TimelineEvent("kill-1", 95, TimelineKind.KILL, new Seat(Side.BLUE, Lane.JUNGLE),
                        new Seat(Side.RED, Lane.MID), List.of(new Seat(Side.BLUE, Lane.MID)), null, null, null, null,
                        "first blood"),
                        new TimelineEvent("slayer-1", 640, TimelineKind.OBJECTIVE, null, null, null, Side.RED,
                                ObjectiveKind.DARK_SLAYER, new Seat(Side.RED, Lane.JUNGLE), null, null)));
        var base = fixture.game();
        var withTimeline = new Game(base.seriesId(), base.number(), base.region(), base.locale(), null, null, null,
                1122, Side.BLUE, "https://www.youtube.com/watch?v=R5rCsGqDJIg", 95, base.note(), base.sides(), false,
                timeline);

        var saved = write(put(ADMIN + "/games/" + id), Map.of("version", version(draft), "content", withTimeline));
        mvc.perform(authorized(get(ADMIN + "/games/" + id))).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.timeline.pauses[0].durationSeconds").value(90))
                .andExpect(jsonPath("$.content.timeline.events[0].assists[0].lane").value("MID"))
                .andExpect(jsonPath("$.content.timeline.events[1].objective").value("DARK_SLAYER"));

        var impossible = new Game(base.seriesId(), base.number(), base.region(), base.locale(), null, null, null, 600,
                null, null, null, null, base.sides(), false,
                new GameTimeline(List.of(), List.of(new TimelineEvent("late", 900, TimelineKind.KILL,
                        new Seat(Side.BLUE, Lane.TOP), new Seat(Side.BLUE, Lane.MID), List.of(), null, null, null,
                        null, null))));
        mvc.perform(authorized(put(ADMIN + "/games/" + id)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", version(saved), "content", impossible))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.missingFields").value(hasItems(
                        "timeline.events[0].atSeconds.range", "timeline.events[0].victim.sameSide")));

        var published = write(post(ADMIN + "/games/" + id + "/publish"), Map.of("version", version(saved)));
        var edited = new Game(base.seriesId(), base.number(), base.region(), base.locale(), null, null, null, 1122,
                Side.BLUE, null, null, base.note(), base.sides(), false, GameTimeline.EMPTY);
        write(put(ADMIN + "/games/" + id), Map.of("version", version(published), "content", edited));
        mvc.perform(get(PUBLIC + "/games/" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.timeline.events.length()").value(2))
                .andExpect(jsonPath("$.content.sourceTimestampSeconds").value(95));
    }

    @Test
    void draftPhaseRoundTripsIsFrozenAndATeamCannotPickAgainAHeroFromAnEarlierGame() throws Exception {
        var fixture = fixture();
        var base = fixture.game();
        var turns = new ArrayList<DraftTurn>();
        for (var side : base.sides())
            for (var ban : side.bans())
                turns.add(new DraftTurn(turns.size() + 1, DraftKind.BAN, side.side(), ban, null));
        for (var side : base.sides())
            for (var participant : side.participants())
                turns.add(new DraftTurn(turns.size() + 1, DraftKind.PICK, side.side(), participant.hero(), null));
        turns.set(0, new DraftTurn(1, DraftKind.BAN, Side.BLUE, base.sides().get(0).bans().get(0), 40));
        var drafted = new Game(base.seriesId(), 1, "VN", "vi-VN", null, null, null, null, null,
                "https://www.youtube.com/watch?v=R5rCsGqDJIg", 230, base.note(), base.sides(), false, null,
                new GameDraft(30, 200, turns));

        var first = create("games", drafted);
        mvc.perform(authorized(get(ADMIN + "/games/" + first.get("id")))).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.draft.startSecond").value(30))
                .andExpect(jsonPath("$.content.draft.lockedSecond").value(200))
                .andExpect(jsonPath("$.content.draft.turns.length()").value(18))
                .andExpect(jsonPath("$.content.draft.turns[0].atSecond").value(40))
                .andExpect(jsonPath("$.content.draft.turns[8].kind").value("PICK"));
        write(post(ADMIN + "/games/" + first.get("id") + "/publish"), Map.of("version", version(first)));
        mvc.perform(get(PUBLIC + "/games/" + first.get("id"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.draft.turns.length()").value(18));

        // Game 2: the blue team plays red and picks again the heroes it played in game 1.
        var blue = base.sides().get(0);
        var red = base.sides().get(1);
        var renamed = new ArrayList<Participant>();
        for (var participant : red.participants())
            renamed.add(new Participant(participant.playerId(), participant.lane(),
                    new Selection(null, participant.hero().name() + " again"), participant.spell(), null, null,
                    List.of(), List.of(), null));
        var swapped = List.of(new GameSide(Side.BLUE, red.teamId(), List.of(), renamed),
                new GameSide(Side.RED, blue.teamId(), List.of(), blue.participants()));
        var repeat = new Game(base.seriesId(), 2, "VN", "vi-VN", null, null, null, null, null, null, null, null,
                swapped, false);
        mvc.perform(authorized(post(ADMIN + "/games")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("content", repeat))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.missingFields").value(hasItems("sides[1].participants[0].hero.usedInSeries")));

        // Game 3 is the last game of this best-of-three, so every hero is open again.
        create("games", new Game(base.seriesId(), 3, "VN", "vi-VN", null, null, null, null, null, null, null, null,
                swapped, false));
    }

    @Test
    void loadoutObservationsKeepTheirGameSecondAndPartialStatus() throws Exception {
        var base = fixture().game();
        var blue = base.sides().get(0);
        var first = blue.participants().get(0);
        var observed = new Participant(first.playerId(), first.lane(), first.hero(), first.spell(),
                new Loadout<>(ObservationStatus.PARTIAL,
                        List.of(new ArcanaAllocation(new Selection(null, null), 10, "RED")), "Tốc đánh", 27),
                new Loadout<>(ObservationStatus.NOT_SHOWN, List.of(), null, 45), List.of(), List.of(), null, 45);
        var participants = new ArrayList<>(blue.participants());
        participants.set(0, observed);
        var sides = List.of(new GameSide(blue.side(), blue.teamId(), blue.bans(), participants), base.sides().get(1));
        var game = create("games", new Game(base.seriesId(), 1, "VN", "vi-VN", null, null, null, 1200, null, null, null,
                null, sides, false));

        mvc.perform(authorized(get(ADMIN + "/games/" + game.get("id")))).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.sides[0].participants[0].arcana.status").value("PARTIAL"))
                .andExpect(jsonPath("$.content.sides[0].participants[0].arcana.observedAtSeconds").value(27))
                .andExpect(jsonPath("$.content.sides[0].participants[0].enchantments.observedAtSeconds").value(45))
                .andExpect(jsonPath("$.content.sides[0].participants[0].spellObservedAtSeconds").value(45))
                .andExpect(jsonPath("$.missingFields").isEmpty());
    }

    @Test
    void gamesStoredBeforeTimelinesReadAsAnEmptyTimeline() throws Exception {
        var draft = create("games", fixture().game());
        try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(),
                database.getPassword());
                var statement = connection
                        .prepareStatement(
                                "UPDATE tournament.game SET content = content - 'timeline' - 'draft' WHERE id = ?")) {
            statement.setObject(1, id(draft));
            assertThat(statement.executeUpdate()).isEqualTo(1);
        }

        mvc.perform(authorized(get(ADMIN + "/games/" + draft.get("id")))).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.timeline.events").isEmpty())
                .andExpect(jsonPath("$.content.timeline.pauses").isEmpty())
                .andExpect(jsonPath("$.content.draft.turns").isEmpty());
    }

    @Test
    void aGameWithALocaleTheCatalogCannotAnswerIsRefusedOnCreateAndUpdate() throws Exception {
        var base = fixture().game();
        var bare = new Game(base.seriesId(), base.number(), base.region(), "vi", null, null, null, null, null, null,
                null, null, base.sides(), false);
        mvc.perform(authorized(post(ADMIN + "/games")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("content", bare)))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.missingFields[0]").value("locale.unsupported"));

        var draft = create("games", base);
        mvc.perform(authorized(put(ADMIN + "/games/" + draft.get("id"))).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", version(draft), "content", bare))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.missingFields[0]").value("locale.unsupported"));
        mvc.perform(authorized(get(ADMIN + "/games/" + draft.get("id"))))
                .andExpect(jsonPath("$.content.locale").value("vi-VN"));
    }

    @Test
    void gamesSavedWithABareLanguageTagAreMigratedToTheSupportedLocale() throws Exception {
        try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(),
                database.getPassword()); var statement = connection.createStatement()) {
            statement.execute("CREATE DATABASE game_locale_test");
        }
        String url = database.getJdbcUrl().substring(0, database.getJdbcUrl().lastIndexOf('/')) + "/game_locale_test";
        Flyway.configure().dataSource(url, database.getUsername(), database.getPassword())
                .locations("classpath:db/migration").target("14").load().migrate();
        UUID imported = UUID.randomUUID(), english = UUID.randomUUID(), open = UUID.randomUUID();
        String snapshot = snapshotWithLocale("vi");
        try (var connection = DriverManager.getConnection(url, database.getUsername(), database.getPassword());
                var statement = connection.createStatement()) {
            String row = "INSERT INTO tournament.game (id,version,content,published_snapshot,created_at,updated_at,"
                    + "edited_by) VALUES ('%s',7,'%s',%s,TIMESTAMPTZ '2026-11-06 00:00:00+00',"
                    + "TIMESTAMPTZ '2026-11-06 00:00:00+00','import')";
            statement.execute(row.formatted(imported, "{\"locale\":\"vi\",\"region\":\"VN\",\"note\":\"kept\"}",
                    "'" + snapshot + "'"));
            statement.execute(row.formatted(english, "{\"locale\":\"en-US\",\"region\":\"VN\"}", "NULL"));
            statement.execute(row.formatted(open, "{\"region\":\"VN\"}", "NULL"));
            statement.execute("INSERT INTO tournament.game_publication (id,game_id,published_at,actor,action,snapshot) "
                    + "VALUES ('" + UUID.randomUUID() + "','" + imported + "',now(),'import','PUBLICATION','"
                    + snapshot + "')");
        }

        Flyway.configure().dataSource(url, database.getUsername(), database.getPassword())
                .locations("classpath:db/migration").load().migrate();
        String migrated = snapshotWithLocale("vi-VN");
        try (var connection = DriverManager.getConnection(url, database.getUsername(), database.getPassword());
                var statement = connection.createStatement()) {
            try (var result = statement.executeQuery("SELECT content ->> 'locale', content ->> 'note', version, "
                    + "updated_at = TIMESTAMPTZ '2026-11-06 00:00:00+00', published_snapshot = CAST('" + migrated
                    + "' AS jsonb) FROM tournament.game WHERE id='" + imported + "'")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString(1)).isEqualTo("vi-VN");
                assertThat(result.getString(2)).isEqualTo("kept");
                // Only the tag moves: an editor holding this version can still save over it.
                assertThat(result.getLong(3)).isEqualTo(7);
                assertThat(result.getBoolean(4)).isTrue();
                assertThat(result.getBoolean(5)).isTrue();
            }
            try (var result = statement.executeQuery("SELECT string_agg(coalesce(content ->> 'locale', 'none'), ',' "
                    + "ORDER BY content ->> 'locale') FROM tournament.game WHERE id IN ('" + english + "','" + open
                    + "')")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString(1)).isEqualTo("en-US,none");
            }
            try (var result = statement.executeQuery("SELECT snapshot = CAST('" + migrated
                    + "' AS jsonb) FROM tournament.game_publication WHERE game_id='" + imported + "'")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getBoolean(1)).isTrue();
            }
        }
    }

    /** The three places a published game repeats its locale, as plain JSON for a row written without the service. */
    private static String snapshotWithLocale(String locale) {
        return ("{\"content\":{\"locale\":\"%1$s\",\"number\":1},\"resolvedContext\":{\"locale\":\"%1$s\"},"
                + "\"catalog\":{\"heroes\":[],\"resolvedContext\":{\"locale\":\"%1$s\"}}}").formatted(locale);
    }

    @Test
    void partialGameSavesAsDraftButCannotPublishAndDuplicateCodeIsConflict() throws Exception {
        var draft = create("games",
                new Game(null, null, null, null, null, null, null, null, null, null, null, null, List.of(), false));
        mvc.perform(authorized(post(ADMIN + "/games/" + draft.get("id") + "/publish"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", version(draft)))))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.missingFields").isArray());
        String code = "duplicate-" + UUID.randomUUID();
        create("teams", new Team(code, "One", null, null, null));
        mvc.perform(authorized(post(ADMIN + "/teams")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("content", new Team(code, "Two", null, null, null)))))
                .andExpect(status().isConflict());
    }

    @Test
    void manualObservationsCanPublishForUnsupportedMarketWithoutClaimingVietnamesePatch() throws Exception {
        var fixture = fixture();
        var context = new ResolvedContext("TH", "vi-VN", null, null, null, null, null, null, true, false);
        when(catalog.read(eq("TH"), eq("vi-VN"), isNull(), isNull(), eq(false)))
                .thenReturn(new Catalog(List.of(), List.of(), List.of(), List.of(), List.of(), context));
        var original = fixture.game();
        var game = new Game(original.seriesId(), original.number(), "TH", "vi-VN", null, null, null, null, null, null,
                null, "Observed international game", original.sides(), false);
        var draft = create("games", game);
        write(post(ADMIN + "/games/" + draft.get("id") + "/publish"), Map.of("version", version(draft)));
        mvc.perform(get(PUBLIC + "/games/" + draft.get("id"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.resolvedContext.region").value("TH"))
                .andExpect(jsonPath("$.resolvedContext.unknown").value(true));
    }

    @Test
    void unsafeSourceLinksCannotReachPublishedMetadata() throws Exception {
        mvc.perform(authorized(post(ADMIN + "/teams")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("content",
                        new Team("unsafe-" + UUID.randomUUID(), "Unsafe", null, null, "javascript:alert(1)")))))
                .andExpect(status().isBadRequest());
        mvc.perform(authorized(post(ADMIN + "/tournaments")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("content", new Tournament("unsafe-" + UUID.randomUUID(),
                        "Unsafe", "VN", 2026, null, null, "data:text/html,test", null)))))
                .andExpect(status().isBadRequest());
        var fixture = fixture();
        var game = fixture.game();
        var unsafe = new Game(game.seriesId(), game.number(), game.region(), game.locale(), null, null, null, null,
                null, "https://user:secret@example.com/video", null, null, game.sides(), false);
        mvc.perform(authorized(post(ADMIN + "/games")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("content", unsafe)))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.missingFields[0]").value("sourceUrl.invalid"));
    }

    @Test
    void summaryPaginationCountsOnlyPublishedSnapshotsAndFiltersByTournament() throws Exception {
        var first = fixture();
        var second = fixture();
        var firstDraft = create("games", first.game());
        var secondDraft = create("games", second.game());
        write(post(ADMIN + "/games/" + firstDraft.get("id") + "/publish"), Map.of("version", version(firstDraft)));
        write(post(ADMIN + "/games/" + secondDraft.get("id") + "/publish"), Map.of("version", version(secondDraft)));
        mvc.perform(get(PUBLIC + "/series?tournamentId=" + first.tournamentId() + "&page=0&size=1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(first.seriesId().toString()))
                .andExpect(jsonPath("$.items[0].gameCount").value(1));
        mvc.perform(get(PUBLIC + "/tournaments?page=0&size=1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1));
        mvc.perform(get(PUBLIC + "/tournaments?page=999&size=1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0));
    }

    @Test
    void editorReferencesRequireReadCapabilityAndStayOffThePublicCatalog() throws Exception {
        mvc.perform(get(ADMIN + "/reference-catalog")).andExpect(status().isUnauthorized());
        mvc.perform(get(ADMIN + "/reference-catalog").with(jwt()))
                .andExpect(status().isForbidden());
        mvc.perform(get(ADMIN + "/reference-catalog")
                .with(jwt().authorities(new SimpleGrantedAuthority("tournament:read"))))
                .andExpect(status().isOk());
        mvc.perform(get(PUBLIC + "/reference-catalog")).andExpect(status().isNotFound());
    }

    @Test
    void editorReferenceSearchFoldsAccentsFindsAliasesAndTracksRenamesWithoutPrivatePlayerDetails() throws Exception {
        String key = UUID.randomUUID().toString();
        var team = create("teams", new Team("reference-" + key, "Đội tuyển " + key, "RFT" + key, "VN",
                "https://img.example.test/team.png"));
        var player = create("players", new Player("reference-" + key, "Chiến binh " + key,
                "Private legal name", "Private country"));
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("q", "DOI TUYEN " + key)
                .param("kind", "TEAM")).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(team.get("id")))
                .andExpect(jsonPath("$.items[0].icon").value("https://img.example.test/team.png"));
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("q", "rft" + key))
                .andExpect(jsonPath("$.items[0].kind").value("team"));
        String body = mvc.perform(authorized(get(ADMIN + "/reference-catalog"))
                .param("q", "chien binh " + key).param("kind", "PLAYER"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(player.get("id")))
                .andExpect(jsonPath("$.items[0].translations[0].description").value(""))
                .andExpect(jsonPath("$.items[0].destinations.admin")
                        .value("/tournaments?tab=players&player=" + player.get("id")))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("Private legal name", "Private country", "fullName", "country");

        write(put(ADMIN + "/teams/" + team.get("id")), Map.of("version", version(team), "content",
                new Team("reference-" + key, "Renamed " + key, "New alias " + key, null, null)));
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("q", "doi tuyen " + key))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("q", "new alias " + key))
                .andExpect(jsonPath("$.items[0].id").value(team.get("id")));
    }

    @Test
    void editorReferencesPageDeterministicallyAndResolveSavedIdsAcrossKinds() throws Exception {
        String key = UUID.randomUUID().toString();
        var first = create("teams", new Team("first-" + key, "A " + key, null, null, null));
        var second = create("teams", new Team("second-" + key, "B " + key, null, null, null));
        var player = create("players", new Player("third-" + key, "C " + key, null, null));
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("q", key).param("page", "1")
                .param("size", "1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.items[0].id").value(second.get("id")))
                .andExpect(jsonPath("$.page").value(1)).andExpect(jsonPath("$.size").value(1));
        String ids = first.get("id") + "," + player.get("id");
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("ids", ids).param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.items[0].id").value(first.get("id")));
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("ids", ids).param("kind", "PLAYER"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(player.get("id")));
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("ids", ids).param("q", "absent"))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("q", key).param("page", "99"))
                .andExpect(jsonPath("$.items.length()").value(0))
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    @Test
    void editorReferenceSearchEscapesWildcardsAndRejectsUnboundedOrUnknownParameters() throws Exception {
        String key = UUID.randomUUID().toString();
        create("teams", new Team("literal-" + key, "50%_boost " + key, null, null, null));
        create("teams", new Team("other-" + key, "50XXboost " + key, null, null, null));
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("q", "%_boost " + key))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("size", "501"))
                .andExpect(status().isBadRequest());
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("q", "x".repeat(121)))
                .andExpect(status().isBadRequest());
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("unexpected", "true"))
                .andExpect(status().isBadRequest());
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("kind", "TOURNAMENT"))
                .andExpect(status().isBadRequest());
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("ids", "not-a-uuid"))
                .andExpect(status().isBadRequest());
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("ids",
                String.join(",", Collections.nCopies(51, UUID.randomUUID().toString()))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void searchMigrationWorksForDatabaseOwnerWithoutSuperuserAndBackfillsExistingRows() throws Exception {
        try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(),
                database.getPassword()); var statement = connection.createStatement()) {
            statement.execute("CREATE ROLE reference_owner LOGIN PASSWORD 'reference-test-only'");
            statement.execute("CREATE DATABASE reference_owner_test OWNER reference_owner");
        }
        String url = database.getJdbcUrl().substring(0, database.getJdbcUrl().lastIndexOf('/'))
                + "/reference_owner_test";
        Flyway.configure().dataSource(url, "reference_owner", "reference-test-only")
                .locations("classpath:db/migration").target("1").load().migrate();
        UUID id = UUID.randomUUID();
        try (var connection = DriverManager.getConnection(url, "reference_owner", "reference-test-only");
                var statement = connection.createStatement()) {
            statement.execute(
                    "INSERT INTO tournament.team (id,version,code,name,content,created_at,updated_at,edited_by) VALUES ('"
                            + id
                            + "',0,'backfilled','Đội tuyển', '{\"shortName\":\"Biệt danh\"}',now(),now(),'test')");
        }

        Flyway.configure().dataSource(url, "reference_owner", "reference-test-only")
                .locations("classpath:db/migration").load().migrate();
        try (var connection = DriverManager.getConnection(url, "reference_owner", "reference-test-only");
                var statement = connection.createStatement();
                var result = statement.executeQuery("SELECT reference_search,current_setting('is_superuser') "
                        + "FROM tournament.team WHERE id='" + id + "'")) {
            assertThat(result.next()).isTrue();
            assertThat(result.getString(1)).isEqualTo("doi tuyen backfilled biet danh");
            assertThat(result.getString(2)).isEqualTo("off");
        }
    }

    @Test
    void teamAliasesAreTrimmedIndexedAndBoundedWithoutOverwritingExistingIdentity() throws Exception {
        String key = UUID.randomUUID().toString();
        var team = create("teams", new Team("aliases-" + key, "Flash Wolves " + key, "FW", "TW", null,
                List.of(" FlashWolves " + key + " ", "閃電狼")));
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("q", "flashwolves " + key))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(team.get("id")))
                .andExpect(jsonPath("$.items[0].translations[0].aliases[2]").value("FlashWolves " + key));
        mvc.perform(authorized(get(ADMIN + "/teams/" + team.get("id"))))
                .andExpect(jsonPath("$.content.aliases[0]").value("FlashWolves " + key));
        for (var aliases : List.of(List.of("FW", " fw "), List.of(""), List.of("x".repeat(101)),
                Collections.nCopies(21, "extra")))
            mvc.perform(authorized(post(ADMIN + "/teams")).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(Map.of("content",
                            new Team("invalid-alias-" + UUID.randomUUID(), "Team", null, null, null, aliases)))))
                    .andExpect(status().isBadRequest());
    }

    @Test
    void tournamentMetadataRoundTripsWithExplicitEvidenceAndRejectsUnsafeLogosOrUnsupportedValues() throws Exception {
        var result = new TournamentResult("Flash Wolves", "Saigon Phantom", 4, 3,
                "https://liquipedia.net/honorofkings/Arena_of_Valor", Verification.SECONDARY_CORROBORATED,
                LocalDate.of(2026, 10, 27));
        var content = new Tournament("metadata-" + UUID.randomUUID(), "International event", "GLOBAL", 2026,
                null, null, "https://example.test/official", null, "https://img.example.test/event.png",
                TournamentTier.S, CompetitionType.CUP, VenueMode.OFFLINE, TournamentStatus.FINISHED, result);
        var created = create("tournaments", content);
        mvc.perform(authorized(get(ADMIN + "/tournaments/" + created.get("id"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content.logoUrl").value(content.logoUrl()))
                .andExpect(jsonPath("$.content.tier").value("S"))
                .andExpect(jsonPath("$.content.competitionType").value("CUP"))
                .andExpect(jsonPath("$.content.venueMode").value("OFFLINE"))
                .andExpect(jsonPath("$.content.result.winnerName").value("Flash Wolves"))
                .andExpect(jsonPath("$.content.result.verification").value("SECONDARY_CORROBORATED"))
                .andExpect(jsonPath("$.content.result.verifiedOn").value("2026-10-27"));
        for (String field : List.of("logoUrl", "tier", "competitionType", "venueMode", "status")) {
            var invalid = new LinkedHashMap<String, Object>(Map.of("code", "invalid-" + UUID.randomUUID(),
                    "name", "Invalid metadata", "region", "GLOBAL"));
            invalid.put(field, field.equals("logoUrl") ? "data:image/png,test" : "UNSUPPORTED");
            mvc.perform(authorized(post(ADMIN + "/tournaments")).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(Map.of("content", invalid))))
                    .andExpect(status().isBadRequest());
        }
        var missingEvidence = new TournamentResult("Winner", "Runner-up", null, null, null, null, null);
        var invalid = new Tournament("no-evidence-" + UUID.randomUUID(), "Result without evidence", "GLOBAL", 2026,
                null, null, null, null, null, null, null, null, null, missingEvidence);
        mvc.perform(authorized(post(ADMIN + "/tournaments")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("content", invalid)))).andExpect(status().isBadRequest());
    }

    @Test
    void olderPublishedSnapshotJsonRemainsReadableWithoutGuessingNewMetadata() {
        UUID teamId = UUID.randomUUID();
        var oldSnapshot = Map.of("id", UUID.randomUUID().toString(),
                "teams", Map.of(teamId.toString(), Map.of("code", "old-team", "name", "Old team")),
                "tournament", Map.of("code", "old-event", "name", "Old event", "region", "VN"));
        var snapshot = json.readValue(json.writeValueAsString(oldSnapshot), PublishedGame.class);
        assertThat(snapshot.teams().get(teamId).aliases()).isEmpty();
        assertThat(snapshot.tournament().logoUrl()).isNull();
        assertThat(snapshot.tournament().tier()).isEqualTo(TournamentTier.UNKNOWN);
        assertThat(snapshot.tournament().status()).isEqualTo(TournamentStatus.UNKNOWN);
        assertThat(snapshot.tournament().result()).isNull();
    }

    @Test
    void playersHaveOptionalSafePhotosAndAliasesWithoutBreakingOldPayloadsOrReferencePrivacy() throws Exception {
        String key = UUID.randomUUID().toString();
        var player = create("players", new Player("photo-" + key, "Player " + key, "Private full name", "VN",
                "https://img.example.test/player.png", List.of(" Old nickname " + key + " ")));
        mvc.perform(authorized(get(ADMIN + "/players")).param("q", "old nickname " + key))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].content.photoUrl").value("https://img.example.test/player.png"));
        String body = mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("kind", "PLAYER")
                .param("q", "old nickname " + key)).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(player.get("id")))
                .andExpect(jsonPath("$.items[0].icon").value("https://img.example.test/player.png"))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("Private full name", "fullName", "country");

        var legacy = json.readValue("{\"code\":\"old-player\",\"nickname\":\"Old player\"}", Player.class);
        assertThat(legacy.photoUrl()).isNull();
        assertThat(legacy.aliases()).isEmpty();
        for (var invalid : List.of(
                new Player("unsafe-" + UUID.randomUUID(), "Unsafe", null, null, "data:image/png,test", List.of()),
                new Player("duplicate-alias-" + UUID.randomUUID(), "Aliases", null, null, null,
                        List.of("Name", " name "))))
            mvc.perform(authorized(post(ADMIN + "/players")).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(Map.of("content", invalid)))).andExpect(status().isBadRequest());
    }

    @Test
    void rostersAreScopedToEventAndTeamWithExplicitUnknownLaneAndEvidence() throws Exception {
        var fixture = fixture();
        var side = fixture.game().sides().get(0);
        UUID playerId = side.participants().get(0).playerId();
        var first = create("roster-memberships", new RosterMembership(fixture.tournamentId(), side.teamId(), playerId,
                null, null, null, null, null, null, null, "Position not shown"));
        var secondTournament = create("tournaments", new Tournament("next-event-" + UUID.randomUUID(),
                "Next event", "GLOBAL", 2026, null, null, null, null));
        var nextTeam = create("teams", new Team("next-team-" + UUID.randomUUID(), "Next team", null, null, null));
        var second = create("roster-memberships", new RosterMembership(id(secondTournament), id(nextTeam), playerId,
                Lane.MID, "7", RosterStatus.ACTIVE, LocalDate.of(2026, 10, 1), null,
                "https://example.test/roster", Verification.SECONDARY_CAPTURE, null));

        mvc.perform(
                authorized(get(ADMIN + "/roster-memberships")).param("tournamentId", fixture.tournamentId().toString())
                        .param("teamId", side.teamId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(first.get("id")))
                .andExpect(jsonPath("$.items[0].content.lane").isEmpty())
                .andExpect(jsonPath("$.items[0].content.status").value("UNKNOWN"))
                .andExpect(jsonPath("$.items[0].content.verification").value("UNVERIFIED"));
        mvc.perform(authorized(get(ADMIN + "/roster-memberships")).param("playerId", playerId.toString())
                .param("page", "0").param("size", "1"))
                .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.items.length()").value(1));
        mvc.perform(authorized(get(ADMIN + "/roster-memberships/" + second.get("id"))))
                .andExpect(jsonPath("$.content.startsOn").value("2026-10-01"))
                .andExpect(jsonPath("$.content.verification").value("SECONDARY_CAPTURE"));
        mvc.perform(authorized(get(ADMIN + "/players/" + playerId)))
                .andExpect(jsonPath("$.content.teamId").doesNotExist());
    }

    @Test
    void rosterMutationUsesIndependentWritePermissionVersionAndUniqueEventTeamPlayer() throws Exception {
        var fixture = fixture();
        var side = fixture.game().sides().get(0);
        var content = new RosterMembership(fixture.tournamentId(), side.teamId(), side.participants().get(0).playerId(),
                Lane.TOP, null, RosterStatus.ACTIVE, null, null, null, null, null);
        mvc.perform(get(ADMIN + "/roster-memberships")).andExpect(status().isUnauthorized());
        mvc.perform(post(ADMIN + "/roster-memberships")
                .with(jwt().authorities(new SimpleGrantedAuthority("tournament:read")))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("content", content))))
                .andExpect(status().isForbidden());
        var row = create("roster-memberships", content);
        mvc.perform(authorized(post(ADMIN + "/roster-memberships")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("content", content)))).andExpect(status().isConflict());
        var changed = new RosterMembership(content.tournamentId(), content.teamId(), content.playerId(), Lane.MID,
                null, RosterStatus.SUBSTITUTE, null, null, null, null, null);
        write(put(ADMIN + "/roster-memberships/" + row.get("id")),
                Map.of("version", version(row), "content", changed));
        mvc.perform(authorized(put(ADMIN + "/roster-memberships/" + row.get("id")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", version(row), "content", changed))))
                .andExpect(status().isConflict());
        mvc.perform(get(PUBLIC + "/roster-memberships")).andExpect(status().isNotFound());
    }

    @Test
    void rosterRejectsMissingIdentitiesUnsafeEvidenceAndUnboundedListQueries() throws Exception {
        var unknown = new RosterMembership(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), null,
                null, null, null, null, null, null, null);
        mvc.perform(authorized(post(ADMIN + "/roster-memberships")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("content", unknown)))).andExpect(status().isBadRequest());
        var fixture = fixture();
        var side = fixture.game().sides().get(0);
        for (String source : List.of("", "javascript:alert(1)")) {
            var invalid = new RosterMembership(fixture.tournamentId(), side.teamId(),
                    side.participants().get(0).playerId(),
                    null, null, null, null, null, source, Verification.PRIMARY, null);
            mvc.perform(authorized(post(ADMIN + "/roster-memberships")).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(Map.of("content", invalid)))).andExpect(status().isBadRequest());
        }
        mvc.perform(authorized(get(ADMIN + "/roster-memberships")).param("size", "501"))
                .andExpect(status().isBadRequest());
        mvc.perform(authorized(get(ADMIN + "/roster-memberships")).param("unexpected", "true"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void recoverableDeletionHidesSearchReservesIdentityAndRestoresWithVersionChecks() throws Exception {
        String code = "trash-" + UUID.randomUUID();
        var team = create("teams", new Team(code, "Trash test " + code, null, null, null));
        String path = ADMIN + "/teams/" + team.get("id");
        mvc.perform(authorized(get(path + "/deletion-impact"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.canDelete").value(true)).andExpect(jsonPath("$.version").value(version(team)));
        mvc.perform(post(path + "/delete").with(jwt().authorities(new SimpleGrantedAuthority("tournament:read")))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isForbidden());
        var deleted = write(post(path + "/delete"), Map.of("version", version(team)));
        assertThat(deleted.get("deletedAt")).isNotNull();
        mvc.perform(authorized(get(ADMIN + "/teams")).param("q", code)).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(authorized(get(ADMIN + "/teams")).param("q", code).param("state", "DELETED"))
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("q", code))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("ids", team.get("id").toString()))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(authorized(get(path))).andExpect(jsonPath("$.deletedAt").isNotEmpty());
        mvc.perform(authorized(put(path)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", version(deleted), "content", team.get("content")))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TOURNAMENT_RECORD_DELETED"));
        mvc.perform(authorized(post(ADMIN + "/teams")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("content", team.get("content")))))
                .andExpect(status().isConflict());
        mvc.perform(authorized(post(path + "/restore")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", version(team)))))
                .andExpect(status().isConflict());
        var restored = write(post(path + "/restore"), Map.of("version", version(deleted)));
        assertThat(restored.get("deletedAt")).isNull();
        assertThat(restored.get("id")).isEqualTo(team.get("id"));
        mvc.perform(authorized(get(ADMIN + "/teams")).param("q", code)).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(authorized(post(path + "/delete")).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict());
    }

    @Test
    void draftJsonReferencesBlockDeletionAndArchivedParentsBlockRestoration() throws Exception {
        var fixture = fixture();
        var side = fixture.game().sides().get(0);
        var game = create("games", fixture.game());
        for (var target : Map.of("teams", side.teamId(), "players", side.participants().get(0).playerId(),
                "tournaments", fixture.tournamentId(), "series", fixture.seriesId()).entrySet()) {
            mvc.perform(authorized(get(ADMIN + "/" + target.getKey() + "/" + target.getValue() + "/deletion-impact")))
                    .andExpect(jsonPath("$.canDelete").value(false)).andExpect(jsonPath("$.usages").isNotEmpty());
            mvc.perform(authorized(post(ADMIN + "/" + target.getKey() + "/" + target.getValue() + "/delete"))
                    .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                    .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TOURNAMENT_RECORD_IN_USE"));
        }
        var deletedGame = write(post(ADMIN + "/games/" + game.get("id") + "/delete"), Map.of("version", version(game)));
        write(post(ADMIN + "/series/" + fixture.seriesId() + "/delete"), Map.of("version", 0));
        mvc.perform(authorized(post(ADMIN + "/games/" + game.get("id") + "/restore"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", version(deletedGame)))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TOURNAMENT_RESTORE_BLOCKED"));

        var roster = create("roster-memberships", new RosterMembership(fixture.tournamentId(), side.teamId(),
                side.participants().get(0).playerId(), null, null, null, null, null, null, null, null));
        mvc.perform(authorized(get(ADMIN + "/teams/" + side.teamId() + "/deletion-impact")))
                .andExpect(jsonPath("$.usages[0].type").value("ROSTER_MEMBERSHIP"));
        var deletedRoster = write(post(ADMIN + "/roster-memberships/" + roster.get("id") + "/delete"),
                Map.of("version", version(roster)));
        var deletedTeam = write(post(ADMIN + "/teams/" + side.teamId() + "/delete"), Map.of("version", 0));
        mvc.perform(authorized(post(ADMIN + "/roster-memberships/" + roster.get("id") + "/restore"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", version(deletedRoster)))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TOURNAMENT_RESTORE_BLOCKED"));
        write(post(ADMIN + "/teams/" + side.teamId() + "/restore"), Map.of("version", version(deletedTeam)));
        write(post(ADMIN + "/roster-memberships/" + roster.get("id") + "/restore"),
                Map.of("version", version(deletedRoster)));
    }

    @Test
    void aTournamentsOwnDraftPlanGoesToTheTrashWithItWhilePublishedPlanHistoryKeepsProtectingIt() throws Exception {
        var fixture = fixture();
        String tournament = ADMIN + "/tournaments/" + fixture.tournamentId();
        write(put(ADMIN + "/competitions/" + fixture.tournamentId()), Map.of("version", 0, "content", Map.of()));
        mvc.perform(authorized(get(ADMIN + "/series/" + fixture.seriesId() + "/deletion-impact")))
                .andExpect(jsonPath("$.canDelete").value(true));
        mvc.perform(authorized(get(tournament + "/deletion-impact")))
                .andExpect(jsonPath("$.usages[*].type", not(hasItem("COMPETITION_PAGE"))));

        write(post(ADMIN + "/series/" + fixture.seriesId() + "/delete"), Map.of("version", 0));
        var current = json.readValue(mvc.perform(authorized(get(tournament))).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsString(), Map.class);
        var deleted = write(post(tournament + "/delete"), Map.of("version", version(current)));
        assertThat(planIds()).doesNotContain(fixture.tournamentId().toString());
        var restored = write(post(tournament + "/restore"), Map.of("version", version(deleted)));
        assertThat(planIds()).contains(fixture.tournamentId().toString());

        try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(),
                database.getPassword());
                var statement = connection.prepareStatement("""
                        INSERT INTO tournament.plan_revision (id, tournament_id, content, action, actor, created_at)
                        VALUES (?, ?, '{}'::jsonb, 'WITHDRAW', 'test-editor', now())
                        """)) {
            statement.setObject(1, UUID.randomUUID());
            statement.setObject(2, fixture.tournamentId());
            statement.executeUpdate();
        }
        mvc.perform(authorized(post(tournament + "/delete")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", version(restored)))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TOURNAMENT_RECORD_IN_USE"))
                .andExpect(jsonPath("$.usages[*].type", hasItem("COMPETITION_PAGE")));
    }

    /** Every plan id the admin season list returns, page by page. */
    private List<String> planIds() throws Exception {
        var ids = new ArrayList<String>();
        for (int page = 0;; page++) {
            var slice = json.readTree(mvc.perform(authorized(get(ADMIN + "/competitions"))
                    .param("page", String.valueOf(page)).param("size", "100"))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
            slice.path("items").forEach(item -> ids.add(item.path("id").asText()));
            if (slice.path("items").isEmpty())
                return ids;
        }
    }

    @Test
    void aPartHangsUnderOneMainEventDoesNotNestAndGoesToTheTrashBeforeIt() throws Exception {
        String marker = "parts-" + UUID.randomUUID();
        var main = create("tournaments", event(marker + "-cup", marker + " Cup", null));
        var other = create("tournaments", event(marker + "-other", marker + " Other", null));
        var part = create("tournaments", event(marker + "-qualifier", marker + " Cup - Qualifier", id(main)));
        String mainPath = ADMIN + "/tournaments/" + main.get("id");
        String otherPath = ADMIN + "/tournaments/" + other.get("id");
        String partPath = ADMIN + "/tournaments/" + part.get("id");

        mvc.perform(authorized(get(partPath)))
                .andExpect(jsonPath("$.content.parentTournamentId").value(main.get("id").toString()));
        mvc.perform(authorized(get(mainPath))).andExpect(jsonPath("$.content.parentTournamentId").isEmpty());

        // Parts do not nest, an event with parts cannot become a part, and nothing is a part of itself.
        mvc.perform(authorized(post(ADMIN + "/tournaments")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("content", event(marker + "-nested", "Nested", id(part))))))
                .andExpect(status().isBadRequest());
        mvc.perform(authorized(put(mainPath)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", version(main), "content",
                        event(marker + "-cup", marker + " Cup", id(other))))))
                .andExpect(status().isBadRequest());
        mvc.perform(authorized(put(otherPath)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", version(other), "content",
                        event(marker + "-other", marker + " Other", id(other))))))
                .andExpect(status().isBadRequest());
        mvc.perform(authorized(post(ADMIN + "/tournaments")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                        Map.of("content", event(marker + "-orphan", "Orphan", UUID.randomUUID())))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TOURNAMENT_RECORD_DELETED"));

        mvc.perform(authorized(get(ADMIN + "/tournaments/parts")).param("parentId", main.get("id").toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(part.get("id").toString()))
                .andExpect(jsonPath("$[0].parentId").value(main.get("id").toString()))
                .andExpect(jsonPath("$[0].name").value(marker + " Cup - Qualifier"))
                .andExpect(jsonPath("$[0].competitionType").value("QUALIFIER"));
        mvc.perform(authorized(get(ADMIN + "/tournaments/parts")).param("parentId", other.get("id").toString()))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(authorized(get(ADMIN + "/tournaments/parts")))
                .andExpect(jsonPath("$[*].id", hasItem(part.get("id").toString())));
        mvc.perform(authorized(get(ADMIN + "/tournaments/parts")).param("q", marker))
                .andExpect(status().isBadRequest());

        // The main event cannot go to the trash before its parts, and a part cannot come back without it.
        mvc.perform(authorized(get(mainPath + "/deletion-impact"))).andExpect(jsonPath("$.canDelete").value(false))
                .andExpect(jsonPath("$.usages[*].type", hasItem("TOURNAMENT_PART")));
        mvc.perform(authorized(post(mainPath + "/delete")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", version(main)))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TOURNAMENT_RECORD_IN_USE"));
        var deletedPart = write(post(partPath + "/delete"), Map.of("version", version(part)));
        mvc.perform(authorized(get(ADMIN + "/tournaments/parts")).param("parentId", main.get("id").toString()))
                .andExpect(jsonPath("$.length()").value(0));
        var deletedMain = write(post(mainPath + "/delete"), Map.of("version", version(main)));
        mvc.perform(authorized(post(partPath + "/restore")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", version(deletedPart)))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TOURNAMENT_RESTORE_BLOCKED"));
        write(post(mainPath + "/restore"), Map.of("version", version(deletedMain)));
        var restoredPart = write(post(partPath + "/restore"), Map.of("version", version(deletedPart)));

        // Detached, it is a main event again and its former main event is free to go.
        write(put(partPath), Map.of("version", version(restoredPart), "content",
                event(marker + "-qualifier", marker + " Cup - Qualifier", null)));
        mvc.perform(authorized(get(partPath))).andExpect(jsonPath("$.content.parentTournamentId").isEmpty());
        mvc.perform(authorized(get(mainPath + "/deletion-impact"))).andExpect(jsonPath("$.canDelete").value(true));
    }

    private static Tournament event(String code, String name, UUID mainEventId) {
        return new Tournament(code, name, "VN", 2026, null, null, null, null, null, null,
                mainEventId == null ? CompetitionType.CUP : CompetitionType.QUALIFIER, null, null, null, null, null,
                null, null, mainEventId);
    }

    @Test
    void publicationAndWithdrawalHistoryPermanentlyProtectIdentityWithoutChangingTheSnapshot() throws Exception {
        var fixture = fixture();
        var draft = create("games", fixture.game());
        String path = ADMIN + "/games/" + draft.get("id");
        var published = write(post(path + "/publish"), Map.of("version", version(draft)));
        var before = mvc.perform(get(PUBLIC + "/games/" + draft.get("id"))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        mvc.perform(authorized(post(path + "/delete")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", version(published)))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TOURNAMENT_RECORD_IN_USE"));
        var after = mvc.perform(get(PUBLIC + "/games/" + draft.get("id"))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(after).isEqualTo(before);
        var withdrawn = write(post(path + "/withdraw"), Map.of("version", version(published)));
        mvc.perform(authorized(post(path + "/delete")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", version(withdrawn)))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.usages[0].type").value("PUBLICATION_HISTORY"))
                .andExpect(jsonPath("$.usages[0].count").value(2));
    }

    @Test
    void editorialWriteFencePreventsAConcurrentChildFromReferencingADeletedTeam() throws Exception {
        var team = create("teams", new Team("race-" + UUID.randomUUID(), "Race team", null, null, null));
        var other = create("teams", new Team("other-" + UUID.randomUUID(), "Other team", null, null, null));
        var event = create("tournaments", new Tournament("race-event-" + UUID.randomUUID(), "Race event", "VN", 2026,
                null, null, null, null));
        var held = new CountDownLatch(1);
        var attempting = new CountDownLatch(1);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var deleting = executor.submit(() -> new TransactionTemplate(transactions).execute(status -> {
                archivePolicy.lockWrites();
                held.countDown();
                try {
                    if (!attempting.await(5, TimeUnit.SECONDS))
                        throw new IllegalStateException("Concurrent writer did not start.");
                } catch (InterruptedException error) {
                    throw new IllegalStateException(error);
                }
                return teamRegistry.lifecycle(id(team), version(team), Action.DELETE, "race-test");
            }));
            assertThat(held.await(5, TimeUnit.SECONDS)).isTrue();
            var writing = executor.submit(() -> {
                attempting.countDown();
                return seriesRegistry.create(new Series("race-series-" + UUID.randomUUID(), id(event), "Race", null,
                        id(team), id(other), 3, null, null, null), "race-test");
            });
            assertThat(deleting.get(10, TimeUnit.SECONDS).deletedAt()).isNotNull();
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> writing.get(10, TimeUnit.SECONDS))
                    .hasCauseInstanceOf(ApiException.class);
        }
    }

    @Test
    void seriesFinalResultRetainsEvidenceAndRejectsScoresOutsideTheBestOfThreshold() throws Exception {
        var fixture = fixture();
        var original = fixture.game().sides();
        var result = new SeriesResult(2, 1, "https://example.test/series-result", Verification.PRIMARY,
                LocalDate.of(2026, 10, 27));
        var series = new Series("result-" + UUID.randomUUID(), fixture.tournamentId(), "Result", null,
                original.get(0).teamId(), original.get(1).teamId(), 3, null, null, null, result);
        var created = create("series", series);
        mvc.perform(authorized(get(ADMIN + "/series/" + created.get("id"))))
                .andExpect(jsonPath("$.content.result.scoreA").value(2))
                .andExpect(jsonPath("$.content.result.verifiedOn").value("2026-10-27"));
        var invalid = new Series(series.code(), series.tournamentId(), series.name(), null, series.teamAId(),
                series.teamBId(),
                3, null, null, null, new SeriesResult(3, 1, "https://example.test/result", null, null));
        mvc.perform(authorized(post(ADMIN + "/series")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("content", invalid)))).andExpect(status().isBadRequest());
    }

    @Test
    void fixedLengthSeriesMayEndLevelAndMustScoreEveryGame() throws Exception {
        var fixture = fixture();
        var sides = fixture.game().sides();
        var level = new Series("draw-" + UUID.randomUUID(), fixture.tournamentId(), "Draw", null, sides.get(0).teamId(),
                sides.get(1).teamId(), 2, null, null, null,
                new SeriesResult(1, 1, "https://example.test/draw", Verification.SECONDARY_CAPTURE, null));
        create("series", level);

        var partial = new Series("partial-" + UUID.randomUUID(), fixture.tournamentId(), "Partial", null,
                sides.get(0).teamId(), sides.get(1).teamId(), 2, null, null, null,
                new SeriesResult(1, 0, "https://example.test/partial", null, null));
        mvc.perform(authorized(post(ADMIN + "/series")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("content", partial)))).andExpect(status().isBadRequest());

        var six = new Series("six-" + UUID.randomUUID(), fixture.tournamentId(), "Six", null, sides.get(0).teamId(),
                sides.get(1).teamId(), 6, null, null, null);
        mvc.perform(authorized(post(ADMIN + "/series")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("content", six)))).andExpect(status().isBadRequest());
    }

    @Test
    void seriesAndGamesFilterByTournamentAndStatsCountWithoutLoadingMatches() throws Exception {
        var fixture = fixture();
        var other = fixture();
        create("games", other.game());
        mvc.perform(authorized(get(ADMIN + "/series")).param("tournamentId", fixture.tournamentId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(fixture.seriesId().toString()));
        mvc.perform(authorized(get(ADMIN + "/games")).param("tournamentId", other.tournamentId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].content.seriesId")
                        .value(other.seriesId().toString()));
        mvc.perform(authorized(get(ADMIN + "/tournaments/stats"))).andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.tournamentId == '%s')].matches", fixture.tournamentId()).value(1))
                .andExpect(jsonPath("$[?(@.tournamentId == '%s')].teams", fixture.tournamentId()).value(2));
        mvc.perform(authorized(get(ADMIN + "/tournaments/stats")).param("unexpected", "true"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void repeatedPicksAreOnlyAcceptedWhenTheMatchWasPlayedWithoutThatRule() throws Exception {
        var fixture = fixture();
        var sides = fixture.game().sides();
        var free = create("series",
                new Series("free-" + UUID.randomUUID(), fixture.tournamentId(), "Free", null, sides.get(0).teamId(),
                        sides.get(1).teamId(), 5, null, null, null, null, true));
        UUID seriesId = UUID.fromString(free.get("id").toString());
        for (int number = 1; number <= 2; number++) {
            var game = new Game(seriesId, number, "VN", "vi-VN", null, null, null, null, null, null, null, null,
                    sides, false, null, null);
            create("games", game);
        }
        mvc.perform(authorized(get(ADMIN + "/games")).param("seriesId", seriesId.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void directoriesDeriveTeamAndPlayerRecordsFromTournamentsSeriesAndRosters() throws Exception {
        String marker = "dir" + UUID.randomUUID().toString().substring(0, 8);
        var champions = create("teams", new Team(marker + "-champions", marker + " Champions", "CHP", "XK", null));
        var rivals = create("teams", new Team(marker + "-rivals", marker + " Rivals", "RVL", "XK", null));
        var starter = create("players", new Player(marker + "-starter", marker + " Starter", "Real Name", "XK", null,
                List.of(), LocalDate.of(2002, 3, 4), null, CareerStatus.ACTIVE, List.of("Nakroth")));
        var former = create("players", new Player(marker + "-former", marker + " Former", null, "XK"));

        var title = create("tournaments", new Tournament(marker + "-title", marker + " Title", "XK", 2025,
                LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 9), null, null, null, TournamentTier.A, null, null,
                null, null, null,
                List.of(new TournamentPlacement("1", id(champions), marker + " Champions", new BigDecimal("1500"),
                        null, null, null),
                        new TournamentPlacement("2", id(rivals), marker + " Rivals", new BigDecimal("500"), null, null,
                                null)),
                null, null));
        create("roster-memberships", new RosterMembership(id(title), id(champions), id(starter), Lane.JUNGLE, null,
                RosterStatus.ACTIVE, null, null, null, null, null));
        create("roster-memberships", new RosterMembership(id(title), id(champions), id(former), Lane.MID, null,
                RosterStatus.INACTIVE, null, null, null, null, null));
        create("series", new Series(marker + "-final", id(title), "Final", null, id(champions), id(rivals), 3, null,
                null, null,
                new SeriesResult(2, 1, "https://example.com/result", Verification.PRIMARY, LocalDate.of(2026, 1, 6)),
                false));
        var newest = create("tournaments", new Tournament(marker + "-newest", marker + " Newest", "XK", 2026,
                LocalDate.of(2026, 1, 5), null, null, null));
        create("series", new Series(marker + "-opener", id(newest), "Opener", null, id(rivals), id(champions), 3, null,
                null, null,
                new SeriesResult(2, 0, "https://example.com/result", Verification.PRIMARY, LocalDate.of(2026, 1, 6)),
                false));

        mvc.perform(authorized(get(ADMIN + "/teams/directory")).param("q", marker).param("sort", "PRIZE"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.items[0].code").value(marker + "-champions"))
                .andExpect(jsonPath("$.items[0].tournaments").value(2))
                .andExpect(jsonPath("$.items[0].matches").value(2))
                .andExpect(jsonPath("$.items[0].wins").value(1))
                .andExpect(jsonPath("$.items[0].losses").value(1))
                .andExpect(jsonPath("$.items[0].titles").value(1))
                .andExpect(jsonPath("$.items[0].prizeUsd").value(1500))
                .andExpect(jsonPath("$.items[0].latestTournament.name").value(marker + " Newest"))
                // The newest tournament has no roster yet, and former members are not part of a lineup.
                .andExpect(jsonPath("$.items[0].lineupTournament.name").value(marker + " Title"))
                .andExpect(jsonPath("$.items[0].lineup.length()").value(1))
                .andExpect(jsonPath("$.items[0].lineup[0].name").value(marker + " Starter"))
                .andExpect(jsonPath("$.items[0].lineup[0].lane").value("JUNGLE"));
        mvc.perform(authorized(get(ADMIN + "/teams/directory")).param("q", marker).param("country", "ZZ"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));

        mvc.perform(authorized(get(ADMIN + "/players/directory")).param("q", marker).param("sort", "NAME"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.items[1].nickname").value(marker + " Starter"))
                .andExpect(jsonPath("$.items[1].lane").value("JUNGLE"))
                .andExpect(jsonPath("$.items[1].titles").value(1))
                .andExpect(jsonPath("$.items[1].tournaments").value(1))
                .andExpect(jsonPath("$.items[1].birthDate").value("2002-03-04"))
                .andExpect(jsonPath("$.items[1].signatureHeroes[0]").value("Nakroth"))
                .andExpect(jsonPath("$.items[1].latestTeam.name").value(marker + " Champions"));
        // A position known only from a roster line still filters.
        mvc.perform(authorized(get(ADMIN + "/players/directory")).param("q", marker).param("lane", "MID"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].nickname").value(marker + " Former"));
        mvc.perform(authorized(get(ADMIN + "/players/directory")).param("q", marker).param("status", "ACTIVE"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].nickname").value(marker + " Starter"));

        mvc.perform(authorized(get(ADMIN + "/players/directory")).param("lane", "NOPE"))
                .andExpect(status().isBadRequest());
        mvc.perform(authorized(get(ADMIN + "/players/directory")).param("sort", "PRIZE"))
                .andExpect(status().isBadRequest());
        mvc.perform(authorized(get(ADMIN + "/teams/directory")).param("unexpected", "1"))
                .andExpect(status().isBadRequest());
        mvc.perform(authorized(get(ADMIN + "/competitions/page-stats"))).andExpect(status().isOk());
    }

    private record Fixture(
            UUID tournamentId,
            UUID seriesId,
            Game game
    ) {
    }

    @Test
    void mediaRetirementProtectsTrashAndPreventsReusingDeletedImageUrls() throws Exception {
        UUID asset = UUID.randomUUID();
        String image = "https://images.example/assets/" + asset + "/" + UUID.randomUUID() + ".png";
        String code = "media-" + UUID.randomUUID();
        var team = create("teams", new Team(code, "Media team", null, null, image));
        mvc.perform(authorized(post(ADMIN + "/media-assets/" + asset + "/retire")))
                .andExpect(status().isConflict());
        var deleted = write(post(ADMIN + "/teams/" + id(team) + "/delete"), Map.of("version", version(team)));
        mvc.perform(authorized(get(ADMIN + "/media-assets/" + asset + "/usage")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.references").value(1));
        mvc.perform(authorized(get(ADMIN + "/media-assets/references")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.references['" + asset + "']").value(1));
        mvc.perform(authorized(post(ADMIN + "/media-assets/" + asset + "/retire")))
                .andExpect(status().isConflict());
        var restored = write(post(ADMIN + "/teams/" + id(team) + "/restore"), Map.of("version", version(deleted)));
        write(put(ADMIN + "/teams/" + id(team)), Map.of("version", version(restored),
                "content", new Team(code, "Media team", null, null, null)));
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(authorized(post(ADMIN + "/media-assets/" + asset + "/retire")))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.retired").value(true));
        }
        mvc.perform(authorized(post(ADMIN + "/teams")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                        Map.of("content", new Team("other-" + UUID.randomUUID(), "Other", null, null, image)))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TOURNAMENT_MEDIA_RETIRED"));
        mvc.perform(authorized(post(ADMIN + "/players")).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("content",
                        new Player("other-" + UUID.randomUUID(), "Other", null, null, image, List.of())))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TOURNAMENT_MEDIA_RETIRED"));
    }

    private Fixture fixture() throws Exception {
        var blue = create("teams", new Team("blue-" + UUID.randomUUID(), "Blue team", null, null, null));
        var red = create("teams", new Team("red-" + UUID.randomUUID(), "Red team", null, null, null));
        var tournament = create("tournaments",
                new Tournament("event-" + UUID.randomUUID(), "Test tournament", "VN", 2026, null, null, null, null));
        UUID tournamentId = id(tournament);
        var series = create("series", new Series("series-" + UUID.randomUUID(), tournamentId, "Test series", null,
                id(blue), id(red), 3, null, null, null));
        UUID seriesId = id(series);
        var sides = new ArrayList<GameSide>();
        int hero = 0;
        for (var side : Side.values()) {
            var roster = new ArrayList<Participant>();
            for (var lane : Lane.values()) {
                var player = create("players", new Player("player-" + UUID.randomUUID(), "Player " + hero, null, null));
                roster.add(new Participant(id(player), lane, new Selection(null, "Hero " + hero++),
                        new Selection(null, "Observed talent"), null, null, List.of(), List.of(), null));
            }
            var bans = new ArrayList<Selection>();
            for (int index = 0; index < 4; index++)
                bans.add(new Selection(null, "Ban " + side + index));
            sides.add(new GameSide(side, side == Side.BLUE ? id(blue) : id(red), bans, roster));
        }
        return new Fixture(tournamentId, seriesId, new Game(seriesId, 1, "VN", "vi-VN", null, null, null, null, null,
                null, null, "published observation", sides, false));
    }

    private Map<String, Object> create(String kind, Object content) throws Exception {
        return write(post(ADMIN + "/" + kind), Map.of("content", content));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> write(MockHttpServletRequestBuilder request, Object content) throws Exception {
        var response = mvc
                .perform(authorized(request).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(content)))
                .andExpect(status().isOk()).andReturn().getResponse();
        return json.readValue(response.getContentAsString(), Map.class);
    }

    private static MockHttpServletRequestBuilder authorized(MockHttpServletRequestBuilder request) {
        return request.with(jwt().jwt(jwt -> jwt.subject("test-editor").issuer("https://issuer.example")).authorities(
                new SimpleGrantedAuthority("tournament:read"), new SimpleGrantedAuthority("tournament:write"),
                new SimpleGrantedAuthority("tournament:publish")));
    }

    private static UUID id(Map<String, Object> view) {
        return UUID.fromString(view.get("id").toString());
    }

    private static long version(Map<String, Object> view) {
        return ((Number) view.get("version")).longValue();
    }
}
