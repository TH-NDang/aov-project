package com.wikiaov.community.tournament.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItems;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.tournament.internal.application.SeriesRegistry;
import com.wikiaov.community.tournament.internal.application.TeamRegistry;
import com.wikiaov.community.tournament.internal.application.WikiCatalog;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.Action;
import com.wikiaov.community.tournament.internal.archive.application.RegistryArchivePolicy;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import java.sql.DriverManager;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
class TournamentApiIntegrationTest {
    static final PostgreSQLContainer DATABASE = new PostgreSQLContainer("postgres:17.6");
    static {
        DATABASE.start();
    }

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", DATABASE::getJdbcUrl);
        properties.add("spring.datasource.username", DATABASE::getUsername);
        properties.add("spring.datasource.password", DATABASE::getPassword);
    }

    @AfterAll
    static void stop() {
        DATABASE.stop();
    }

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
        try (var connection = DriverManager.getConnection(DATABASE.getJdbcUrl(), DATABASE.getUsername(),
                DATABASE.getPassword());
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
        mvc.perform(authorized(get(ADMIN + "/reference-catalog")).param("size", "101"))
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
        try (var connection = DriverManager.getConnection(DATABASE.getJdbcUrl(), DATABASE.getUsername(),
                DATABASE.getPassword()); var statement = connection.createStatement()) {
            statement.execute("CREATE ROLE reference_owner LOGIN PASSWORD 'reference-test-only'");
            statement.execute("CREATE DATABASE reference_owner_test OWNER reference_owner");
        }
        String url = DATABASE.getJdbcUrl().substring(0, DATABASE.getJdbcUrl().lastIndexOf('/'))
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
        mvc.perform(authorized(get(ADMIN + "/roster-memberships")).param("size", "101"))
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

    private record Fixture(
            UUID tournamentId,
            UUID seriesId,
            Game game
    ) {
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
