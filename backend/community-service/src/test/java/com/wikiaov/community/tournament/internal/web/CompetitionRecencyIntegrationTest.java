package com.wikiaov.community.tournament.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.community.testsupport.CommunityApplicationTest;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.CompetitionType;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Player;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.RosterMembership;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.RosterStatus;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.SeriesResult;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Team;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TournamentStatus;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TournamentTier;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Verification;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** The recency rules of spec 04, on real SQL and through the API. */
@CommunityApplicationTest
class CompetitionRecencyIntegrationTest {
    static final String ROOT = "/api/community/v1";
    static final String ADMIN = ROOT + "/admin";
    static final LocalDate TODAY = LocalDate.now();

    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @Autowired
    JdbcTemplate sql;
    @MockitoBean
    JwtDecoder decoder;

    @Test
    void tournamentRankFollowsTheDatesAroundToday() {
        assertThat(rank("ONGOING", "2026-08-29", "2026-11-07", 2026)).as("ends today").isZero();
        assertThat(rank("UNKNOWN", "2026-11-07", "2026-11-07", 2026)).as("today only").isZero();
        assertThat(rank("UPCOMING", "2026-10-01", "2026-12-01", 2026)).as("dates beat a stale status").isZero();
        assertThat(rank("UPCOMING", "2026-11-08", "2026-11-08", 2026)).as("tomorrow").isEqualTo(1);
        assertThat(rank("UPCOMING", "2026-12-07", "2026-12-08", 2026)).as("in 30 days").isEqualTo(1);
        assertThat(rank("UPCOMING", "2026-12-08", "2026-12-09", 2026)).as("in 31 days").isEqualTo(2);
        assertThat(rank("ONGOING", "2026-01-01", "2026-11-06", 2026)).as("ended yesterday").isEqualTo(2);
        assertThat(rank("FINISHED", "2026-10-01", "2026-12-01", 2026)).as("declared over").isEqualTo(2);

        assertThat(rank("ONGOING", null, null, null)).as("status alone").isZero();
        assertThat(rank("ANNOUNCED", null, null, null)).as("status alone").isEqualTo(1);
        assertThat(rank("UNKNOWN", null, null, 2019)).as("year alone").isEqualTo(2);
        assertThat(rank("UNKNOWN", null, null, null)).as("nothing at all").isEqualTo(3);
        assertThat(rank("ONGOING", "2026-01-01", null, 2026)).as("started, no end").isZero();
        assertThat(rank("UNKNOWN", "2026-01-01", null, 2026)).as("started long ago, no end").isEqualTo(2);
    }

    @Test
    void tournamentDistanceReadsEitherWayFromToday() {
        assertThat(distance("2026-08-29", "2026-11-15", 2026)).as("ends in 8 days").isEqualTo(8);
        assertThat(distance("2026-11-16", "2026-11-17", 2026)).as("starts in 9 days").isEqualTo(9);
        assertThat(distance("2026-10-19", "2026-11-01", 2026)).as("ended 6 days ago").isEqualTo(6);
        assertThat(distance("2027-11-07", "2027-11-08", 2027)).as("a year ahead").isEqualTo(365);
        assertThat(distance("2025-11-01", "2025-11-07", 2025)).as("a year behind").isEqualTo(365);
        assertThat(distance(null, null, 2026)).as("this year, no dates").isZero();
        assertThat(distance(null, null, 2024)).as("two years back").isEqualTo(676);
    }

    @Test
    void namesMatchWholeThenStartThenWordThenAnywhere() {
        var names = "|saigon phantom|sgp|sai gon team|";

        assertThat(match("SGP", names)).isZero();
        assertThat(match("Sài Gòn Team", names)).isZero();
        assertThat(match("saig", names)).isEqualTo(1);
        assertThat(match("phant", names)).isEqualTo(2);
        assertThat(match("igon", names)).isEqualTo(3);
        assertThat(match("", names)).isZero();
        assertThat(sql.queryForObject("SELECT tournament.search_key('Season-14: Finals (2026)')", String.class))
                .isEqualTo("season 14 finals 2026");
    }

    @Test
    void documentDatesAreReadInEitherFormAndAbsentOnesStayEmpty() {
        assertThat(documentDate("[2026, 11, 7]")).isEqualTo("2026-11-07");
        assertThat(documentDate("\"2026-11-07\"")).isEqualTo("2026-11-07");
        assertThat(documentDate("null")).isNull();
        assertThat(sql.queryForObject(
                "SELECT CAST(tournament.document_instant('1578182400.000000000') AT TIME ZONE 'UTC' AS text)",
                String.class)).isEqualTo("2020-01-05 00:00:00");
        assertThat(sql.queryForObject(
                "SELECT CAST(tournament.document_instant('\"2020-01-05T07:00:00+07:00\"') AT TIME ZONE 'UTC' AS text)",
                String.class)).isEqualTo("2020-01-05 00:00:00");
    }

    @Test
    void tournamentsRunFromThePresentOutwardsAndNoDateGoesLast() throws Exception {
        var marker = marker("tourney");
        tournament(marker, "ended-120", -125, -120);
        tournament(marker, "far-ahead", 100, 110);
        tournament(marker, "b-ended-50", -60, -50);
        tournament(marker, "a-ended-50", -60, -50);
        tournament(marker, "soon-12", 12, 14);
        tournament(marker, "soon-5", 5, 6);
        tournament(marker, "running-long", -30, 40);
        tournament(marker, "running-short", -3, 2);
        create("tournaments", new Tournament(marker + "-z-undated", marker + " z-undated", "VN", null, null, null,
                null, null));
        create("tournaments", new Tournament(marker + "-y-undated", marker + " y-undated", "VN", null, null, null,
                null, null));

        assertThat(contentCodes(tournaments(marker))).containsExactly(marker + "-running-short",
                marker + "-running-long", marker + "-soon-5", marker + "-soon-12", marker + "-a-ended-50",
                marker + "-b-ended-50", marker + "-far-ahead", marker + "-ended-120", marker + "-y-undated",
                marker + "-z-undated");
    }

    @Test
    void anOlderWayToOrderTournamentsStaysAvailable() throws Exception {
        var marker = marker("order");
        tournament(marker, "recent", -10, -8);
        tournament(marker, "older", -300, -290);

        assertThat(contentCodes(read(get(ADMIN + "/tournaments").param("q", marker).param("sort", "NAME"))))
                .containsExactly(marker + "-older", marker + "-recent");
        assertThat(contentCodes(read(get(ADMIN + "/tournaments").param("q", marker).param("sort", "STATUS"))))
                .containsExactly(marker + "-recent", marker + "-older");
        assertThat(contentCodes(read(get(ADMIN + "/tournaments").param("q", marker).param("sort", "UPDATED"))))
                .containsExactly(marker + "-older", marker + "-recent");
        authorizedFails(get(ADMIN + "/tournaments").param("sort", "NOPE"));
        authorizedFails(get(ADMIN + "/tournaments").param("status", "NOPE"));
    }

    @Test
    void tournamentsCanBeNarrowedAndTheirFacetsCountWhatExists() throws Exception {
        var marker = marker("facets");
        create("tournaments", new Tournament(marker + "-thai", marker + " thai", "TH", 2023, null, null, null, null,
                null, TournamentTier.A, null, null, TournamentStatus.FINISHED, null));
        create("tournaments", new Tournament(marker + "-viet", marker + " viet", "VN", 2022, null, null, null, null,
                null, TournamentTier.B, null, null, TournamentStatus.ONGOING, null));

        assertThat(contentCodes(read(get(ADMIN + "/tournaments").param("q", marker).param("region", "TH"))))
                .containsExactly(marker + "-thai");
        assertThat(contentCodes(read(get(ADMIN + "/tournaments").param("q", marker).param("tier", "B"))))
                .containsExactly(marker + "-viet");
        assertThat(contentCodes(read(get(ADMIN + "/tournaments").param("q", marker).param("year", "2023"))))
                .containsExactly(marker + "-thai");
        assertThat(contentCodes(read(get(ADMIN + "/tournaments").param("q", marker).param("status", "ONGOING"))))
                .containsExactly(marker + "-viet");

        var facets = read(get(ADMIN + "/tournaments/facets"));
        assertThat(facets.path("statuses").path("ONGOING").asInt()).isPositive();
        assertThat(facets.path("regions").propertyNames()).contains("TH", "VN");
        assertThat(facets.path("years").propertyNames()).contains("2023", "2022");
        assertThat(facets.path("total").asInt()).isGreaterThanOrEqualTo(2);
    }

    @Test
    void aFacetCountsWhatTheSearchAndTheOtherFiltersLeaveOfIt() throws Exception {
        var marker = marker("counted");
        create("tournaments", new Tournament(marker + "-thai", marker + " thai", "TH", 2023, null, null, null, null,
                null, TournamentTier.A, null, null, TournamentStatus.FINISHED, null));
        create("tournaments", new Tournament(marker + "-viet", marker + " viet", "VN", 2022, null, null, null, null,
                null, TournamentTier.B, null, null, TournamentStatus.FINISHED, null));

        var facets = read(get(ADMIN + "/tournaments/facets").param("q", marker).param("region", "TH"));

        assertThat(facets.path("regions").propertyNames()).containsExactlyInAnyOrder("TH", "VN");
        assertThat(facets.path("tiers").propertyNames()).containsExactly("A");
        assertThat(facets.path("years").propertyNames()).containsExactly("2023");
        assertThat(facets.path("statuses").path("FINISHED").asInt()).isEqualTo(1);
        authorizedFails(get(ADMIN + "/tournaments/facets").param("tier", "NOPE"));
    }

    @Test
    void theMainEventListLeavesPartsOutFindsAnEventThroughThemAndPlacesItByItsNearestPart() throws Exception {
        var marker = marker("events");
        var championship = tournament(marker, "championship", 60, 70);
        part(marker, "wildcard", championship, -1, 1);
        part(marker, "open-qualifier", championship, -30, -28);
        var ended = tournament(marker, "ended", -20, -10);
        part(marker, "ended-qualifier", ended, -40, -35);

        // The full list keeps every tournament, each placed by its own dates.
        assertThat(contentCodes(tournaments(marker))).containsExactly(marker + "-wildcard", marker + "-ended",
                marker + "-open-qualifier", marker + "-ended-qualifier", marker + "-championship");

        // A wildcard in progress brings its main event forward although the main event is two months away.
        var events = read(get(ADMIN + "/tournaments").param("q", marker).param("level", "MAIN"));
        assertThat(contentCodes(events)).containsExactly(marker + "-championship", marker + "-ended");
        assertThat(events.path("totalElements").asInt()).isEqualTo(2);
        assertThat(contentCodes(read(get(ADMIN + "/tournaments").param("q", marker + " wildcard")
                .param("level", "MAIN")))).containsExactly(marker + "-championship");
        assertThat(contentCodes(read(get(ADMIN + "/tournaments").param("q", marker + " wildcard"))))
                .containsExactly(marker + "-wildcard");
        authorizedFails(get(ADMIN + "/tournaments").param("level", "NOPE"));

        var parts = read(get(ADMIN + "/tournaments/parts").param("parentId", championship.toString()));
        assertThat(parts.findValuesAsString("name")).containsExactly(marker + " open-qualifier",
                marker + " wildcard");

        var every = read(get(ADMIN + "/tournaments/facets"));
        var main = read(get(ADMIN + "/tournaments/facets").param("level", "MAIN"));
        assertThat(every.path("total").asInt() - main.path("total").asInt()).isGreaterThanOrEqualTo(3);
        authorizedFails(get(ADMIN + "/tournaments/facets").param("level", "NOPE"));
    }

    @Test
    void anUnknownTournamentLevelIsAnInvalidQueryParameter() throws Exception {
        mvc.perform(authorized(get(ADMIN + "/tournaments").param("level", "NOPE")))
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"))
                .andExpect(jsonPath("$.errors[0].path").value("level"));
    }

    @Test
    void aPartIsASeasonOfAPageOnlyWhereItsMainEventIsNot() throws Exception {
        var marker = marker("seasons");
        var organizer = page("ORGANIZATION", marker + "-organizer", null, Map.of("name", marker + " organizer"));
        var partner = page("ORGANIZATION", marker + "-partner", null, Map.of("name", marker + " partner"));
        var cup = tournament(marker, "cup", -20, -10);
        var ownQualifier = part(marker, "own-qualifier", cup, -40, -35);
        var partnerQualifier = part(marker, "partner-qualifier", cup, -50, -45);
        organizedBy(cup, organizer);
        organizedBy(ownQualifier, organizer);
        organizedBy(partnerQualifier, partner);

        assertThat(ids(read(get(ADMIN + "/competitions").param("organizerPageId", organizer.path("id").asText()))))
                .containsExactly(cup.toString());
        assertThat(ids(read(get(ADMIN + "/competitions").param("organizerPageId", partner.path("id").asText()))))
                .containsExactly(partnerQualifier.toString());

        var stats = read(get(ADMIN + "/competitions/page-stats"));
        assertThat(seasonsOf(stats, organizer)).isEqualTo(1);
        assertThat(seasonsOf(stats, partner)).isEqualTo(1);
    }

    @Test
    void pagingThroughTiesNeverRepeatsOrSkipsARow() throws Exception {
        var marker = marker("ties");
        var expected = new ArrayList<String>();
        for (int index = 0; index < 7; index++) {
            tournament(marker, "same-" + index, -20, -10);
            create("teams", new Team(marker + "-team-" + index, marker + " twin", null, null, null));
            create("players", new Player(marker + "-player-" + index, marker + " twin", null, null));
            expected.add(marker + "-same-" + index);
        }

        assertThat(walk("/tournaments", marker)).containsExactlyInAnyOrderElementsOf(expected);
        assertThat(new HashSet<>(walk("/teams", marker))).hasSize(7);
        assertThat(walk("/teams", marker)).hasSize(7);
        assertThat(new HashSet<>(walk("/players", marker))).hasSize(7);
        assertThat(walk("/players", marker)).hasSize(7);
    }

    @Test
    void teamsRankByTheirLastGameAndABadDateCannotLiftThem() throws Exception {
        var marker = marker("teams");
        var old = tournament(marker, "old-season", -420, -400);
        var mid = tournament(marker, "mid-season", -110, -100);
        var recent = tournament(marker, "recent-season", -20, -10);
        var running = tournament(marker, "running-season", -5, 20);
        var distant = tournament(marker, "distant-season", 200, 210);

        var active = team(marker, "active");
        var lateDated = team(marker, "late-dated");
        var undated = team(marker, "undated");
        var upcoming = team(marker, "upcoming");
        var distantOnly = team(marker, "distant-only");
        team(marker, "never-played");
        var rival = team(marker, "rival");

        series(recent, active, rival, TODAY.minusDays(12), true);
        // A year after its tournament ended: the kind of date the import holds. It must not read as last month.
        series(old, lateDated, rival, TODAY.minusDays(1), true);
        series(mid, undated, rival, null, true);
        // Scheduled but not yet played, in a tournament still running: in the tournament, not a game today.
        series(running, upcoming, rival, TODAY.plusDays(3), false);
        roster(distant, distantOnly, player(marker, "distant-player"), RosterStatus.ACTIVE);

        var rows = read(get(ADMIN + "/teams").param("q", marker).param("size", "20"));
        assertThat(contentCodes(rows)).containsExactly(marker + "-rival", marker + "-upcoming", marker + "-active",
                marker + "-undated", marker + "-late-dated", marker + "-distant-only", marker + "-never-played");
        assertThat(activeOn(rows, marker + "-active")).isEqualTo(TODAY.minusDays(12).toString());
        assertThat(activeOn(rows, marker + "-late-dated")).isEqualTo(TODAY.minusDays(400).toString());
        assertThat(activeOn(rows, marker + "-undated")).isEqualTo(TODAY.minusDays(100).toString());
        assertThat(activeOn(rows, marker + "-upcoming")).isEqualTo(TODAY.toString());
        assertThat(activeOn(rows, marker + "-distant-only")).isNull();
        assertThat(activeOn(rows, marker + "-never-played")).isNull();
        assertThat(rows.path("items").get(0).path("version").isMissingNode()).isFalse();

        var directory = read(get(ADMIN + "/teams/directory").param("q", marker).param("size", "20"));
        assertThat(flatCodes(directory)).containsExactlyElementsOf(contentCodes(rows));
        assertThat(entry(directory, marker + "-active").path("lastActiveOn").asText())
                .isEqualTo(TODAY.minusDays(12).toString());
        assertThat(entry(directory, marker + "-late-dated").path("latestTournament").path("name").asText())
                .isEqualTo(marker + " old-season");
        assertThat(entry(directory, marker + "-never-played").path("lastActiveOn").isNull()).isTrue();

        assertThat(
                contentCodes(read(get(ADMIN + "/teams").param("q", marker).param("sort", "NAME").param("size", "20")))
                        .getFirst())
                .isEqualTo(marker + "-active");
    }

    @Test
    void aDeletedMatchNoLongerDatesATeamAndTrashKeepsItsOwnOrder() throws Exception {
        var marker = marker("trash");
        var older = tournament(marker, "older", -300, -290);
        var newer = tournament(marker, "newer", -40, -30);
        var a = team(marker, "a");
        var b = team(marker, "b");
        series(older, a, b, TODAY.minusDays(295), true);
        var latest = series(newer, a, b, TODAY.minusDays(35), true);

        assertThat(activeOn(read(get(ADMIN + "/teams").param("q", marker)), marker + "-a"))
                .isEqualTo(TODAY.minusDays(35).toString());

        send(post(ADMIN + "/series/" + latest.path("id").asText() + "/delete"),
                Map.of("version", latest.path("version").asLong()));

        assertThat(activeOn(read(get(ADMIN + "/teams").param("q", marker)), marker + "-a"))
                .isEqualTo(TODAY.minusDays(295).toString());
        assertThat(contentCodes(read(get(ADMIN + "/series").param("q", marker).param("state", "DELETED")))).hasSize(1);
        var deleted = read(get(ADMIN + "/teams").param("q", marker).param("state", "ALL"));
        assertThat(deleted.path("items").get(0).has("lastActiveOn")).isFalse();
    }

    @Test
    void aPlayerIsFoundByTheirRealName() throws Exception {
        var marker = marker("real-name");
        var realName = "Nguyễn Văn " + marker;
        create("players", new Player(marker + "-player", "Stage" + marker, realName, null));

        for (var search : List.of(realName, "nguyen van " + marker)) {
            assertThat(contentCodes(read(get(ADMIN + "/players").param("q", search))))
                    .containsExactly(marker + "-player");
            assertThat(flatCodes(read(get(ADMIN + "/players/directory").param("q", search))))
                    .containsExactly(marker + "-player");
        }
    }

    @Test
    void aStrongNameMatchBeatsARecentWeakOne() throws Exception {
        var marker = marker("names");
        var old = tournament(marker, "old", -2000, -1990);
        var recent = tournament(marker, "recent", -9, -7);
        var retired = create("players", new Player(marker + "-retired", "Zen" + marker, null, null));
        var alias = create("players",
                new Player(marker + "-alias", "Other" + marker, null, null, null, List.of("Zen" + marker + "x")));
        var prefix = create("players", new Player(marker + "-prefix", "Zen" + marker + " Junior", null, null));
        var word = create("players", new Player(marker + "-word", "Old Zen" + marker, null, null));
        var inside = create("players", new Player(marker + "-inside", "Citizen" + marker, null, null));
        var oldTeam = team(marker, "old-team");
        var recentTeam = team(marker, "recent-team");
        roster(old, oldTeam, id(retired), RosterStatus.ACTIVE);
        roster(recent, recentTeam, id(prefix), RosterStatus.ACTIVE);
        roster(recent, recentTeam, id(word), RosterStatus.ACTIVE);
        roster(recent, recentTeam, id(inside), RosterStatus.ACTIVE);
        roster(old, oldTeam, id(alias), RosterStatus.ACTIVE);

        var exact = "Zen" + marker;
        assertThat(contentCodes(read(get(ADMIN + "/players").param("q", exact)))).containsExactly(marker + "-retired",
                marker + "-prefix", marker + "-alias", marker + "-word", marker + "-inside");
        assertThat(flatCodes(read(get(ADMIN + "/players/directory").param("q", exact))).getFirst())
                .isEqualTo(marker + "-retired");
        // Accents and case do not hide an exact name, and an alias is a name too.
        assertThat(contentCodes(read(get(ADMIN + "/players").param("q", ("ZÉN" + marker).toUpperCase(Locale.ROOT))))
                .getFirst()).isEqualTo(marker + "-retired");
        assertThat(contentCodes(read(get(ADMIN + "/players").param("q", exact + "x"))).getFirst())
                .isEqualTo(marker + "-alias");

        var references = read(get(ADMIN + "/reference-catalog").param("q", exact).param("kind", "PLAYER"));
        assertThat(references.path("items").get(0).path("id").asText()).isEqualTo(id(retired).toString());
        // An explicit order is taken at its word.
        assertThat(contentCodes(read(get(ADMIN + "/players").param("q", exact).param("sort", "NAME"))).getFirst())
                .isEqualTo(marker + "-inside");
    }

    @Test
    void aPlayerTakesTheDateOfTheirRosterAndOneWhoLeftOnlyUpToItsFirstDay() throws Exception {
        var marker = marker("players");
        var season = tournament(marker, "season", -40, -10);
        var older = tournament(marker, "older", -500, -480);
        var team = team(marker, "club");
        var rival = team(marker, "rival");
        series(season, team, rival, TODAY.minusDays(11), true);

        var starter = player(marker, "starter");
        var substitute = player(marker, "substitute");
        var departed = player(marker, "departed");
        var veteran = player(marker, "veteran");
        player(marker, "unrostered");
        roster(season, team, starter, RosterStatus.ACTIVE);
        roster(season, team, substitute, RosterStatus.SUBSTITUTE);
        roster(season, team, departed, RosterStatus.INACTIVE);
        roster(older, team, veteran, RosterStatus.ACTIVE);

        var rows = read(get(ADMIN + "/players").param("q", marker).param("size", "20"));
        assertThat(contentCodes(rows)).containsExactly(marker + "-starter", marker + "-substitute",
                marker + "-departed", marker + "-veteran", marker + "-unrostered");
        assertThat(activeOn(rows, marker + "-starter")).isEqualTo(TODAY.minusDays(11).toString());
        assertThat(activeOn(rows, marker + "-departed")).isEqualTo(TODAY.minusDays(40).toString());
        assertThat(activeOn(rows, marker + "-veteran")).isEqualTo(TODAY.minusDays(480).toString());
        assertThat(activeOn(rows, marker + "-unrostered")).isNull();

        var directory = read(get(ADMIN + "/players/directory").param("q", marker).param("size", "20"));
        assertThat(flatCodes(directory)).containsExactlyElementsOf(contentCodes(rows));
        assertThat(entry(directory, marker + "-starter").path("latestTeam").path("name").asText())
                .isEqualTo(marker + " club");
        assertThat(entry(directory, marker + "-veteran").path("latestTournament").path("name").asText())
                .isEqualTo(marker + " older");
    }

    @Test
    void aPickerPutsItsOwnContextFirstButAnExactNameStillWins() throws Exception {
        var marker = marker("context");
        var here = tournament(marker, "here", -700, -690);
        var elsewhere = tournament(marker, "elsewhere", -5, -3);
        var ours = team(marker, "ours");
        var theirs = team(marker, "theirs");
        var newcomer = team(marker, "newcomer");

        var inThisRoster = player(marker, "in-this-roster");
        var fromThisTeam = player(marker, "from-this-team");
        var inThisEvent = player(marker, "in-this-event");
        var fresh = player(marker, "fresh");
        roster(here, ours, inThisRoster, RosterStatus.ACTIVE);
        roster(elsewhere, ours, fromThisTeam, RosterStatus.ACTIVE);
        roster(here, theirs, inThisEvent, RosterStatus.ACTIVE);
        roster(elsewhere, newcomer, fresh, RosterStatus.ACTIVE);

        var teams = read(get(ADMIN + "/teams").param("q", marker).param("tournamentId", here.toString()));
        assertThat(contentCodes(teams)).containsExactly(marker + "-ours", marker + "-theirs", marker + "-newcomer");
        assertThat(teams.path("items").get(0).path("context").asText()).isEqualTo("TOURNAMENT");
        assertThat(teams.path("items").get(2).has("context")).isFalse();
        // Without a context the most recent team leads, so it was the context that moved the others up.
        assertThat(contentCodes(read(get(ADMIN + "/teams").param("q", marker))).getFirst())
                .isEqualTo(marker + "-newcomer");
        assertThat(contentCodes(read(get(ADMIN + "/teams").param("q", marker + " newcomer")
                .param("tournamentId", here.toString()))).getFirst()).isEqualTo(marker + "-newcomer");

        var players = read(get(ADMIN + "/players").param("q", marker).param("teamId", ours.toString())
                .param("tournamentId", here.toString()));
        assertThat(contentCodes(players)).containsExactly(marker + "-in-this-roster", marker + "-from-this-team",
                marker + "-in-this-event", marker + "-fresh");
        assertThat(players.path("items").get(0).path("context").asText()).isEqualTo("TEAM_IN_TOURNAMENT");
        assertThat(players.path("items").get(1).path("context").asText()).isEqualTo("TEAM");
        assertThat(players.path("items").get(2).path("context").asText()).isEqualTo("TOURNAMENT");
        assertThat(players.path("items").get(3).has("context")).isFalse();

        var seasons = read(get(ADMIN + "/tournaments").param("q", marker).param("teamId", theirs.toString()));
        assertThat(contentCodes(seasons)).containsExactly(marker + "-here", marker + "-elsewhere");
        assertThat(seasons.path("items").get(0).path("context").asText()).isEqualTo("PARTICIPANT");
        var seasonsOfPlayer = read(get(ADMIN + "/tournaments").param("q", marker)
                .param("playerId", inThisRoster.toString()));
        assertThat(contentCodes(seasonsOfPlayer)).containsExactly(marker + "-here", marker + "-elsewhere");
    }

    @Test
    void matchesRunInScheduleOrderInsideATournamentWithUndatedOnesLast() throws Exception {
        var marker = marker("matches");
        var season = tournament(marker, "season", -40, -10);
        var a = team(marker, "a");
        var b = team(marker, "b");
        var undated = series(season, a, b, null, true);
        var later = series(season, a, b, TODAY.minusDays(12), true);
        var earlier = series(season, a, b, TODAY.minusDays(30), true);

        var rows = read(get(ADMIN + "/series").param("tournamentId", season.toString()));
        assertThat(ids(rows)).containsExactly(earlier.path("id").asText(), later.path("id").asText(),
                undated.path("id").asText());
        var across = read(get(ADMIN + "/series").param("q", marker));
        assertThat(ids(across)).containsExactly(later.path("id").asText(), earlier.path("id").asText(),
                undated.path("id").asText());
    }

    @Test
    void seasonsOfAnOrganizerRunLikeTheTournamentListAndPagesRankByTheirActivity() throws Exception {
        var marker = marker("pages");
        var organizer = page("ORGANIZATION", marker + "-organizer", null, Map.of("name", marker + " organizer"));
        page("ORGANIZATION", marker + "-idle", null, Map.of("name", marker + " idle"));
        var older = tournament(marker, "older", -800, -790);
        var running = tournament(marker, "running", -2, 6);
        var ended = tournament(marker, "ended", -60, -50);
        for (var season : List.of(older, running, ended)) {
            send(put(ADMIN + "/competitions/" + season), Map.of("version", 0, "content",
                    Map.of("organizerPageId", organizer.path("id").asText())));
        }

        var seasons = read(get(ADMIN + "/competitions").param("organizerPageId", organizer.path("id").asText()));
        assertThat(ids(seasons)).containsExactly(running.toString(), ended.toString(), older.toString());
        assertThat(seasons.path("totalElements").asInt()).isEqualTo(3);

        var organizers = read(activePages(marker).param("kind", "ORGANIZATION"));
        assertThat(flatCodes(organizers)).containsExactly(marker + "-organizer", marker + "-idle");
        assertThat(entry(organizers, marker + "-organizer").path("lastActiveOn").asText()).isEqualTo(TODAY.toString());
        assertThat(entry(organizers, marker + "-idle").has("lastActiveOn")).isFalse();

        var club = team(marker, "club");
        var rival = team(marker, "rival");
        series(ended, club, rival, TODAY.minusDays(55), true);
        var recent = player(marker, "recent");
        var veteran = player(marker, "veteran");
        var clubPage = page("TEAM", marker + "-club-page", club, Map.of("name", marker + " Club"));
        roster(ended, club, recent, RosterStatus.ACTIVE);
        roster(older, club, veteran, RosterStatus.ACTIVE);
        page("PLAYER", marker + "-recent-page", recent, Map.of("name", marker + " Recent"));
        page("PLAYER", marker + "-veteran-page", veteran, Map.of("name", marker + " Veteran"));

        var players = read(activePages(marker).param("kind", "PLAYER"));
        assertThat(flatCodes(players)).containsExactly(marker + "-recent-page", marker + "-veteran-page");
        assertThat(entry(players, marker + "-recent-page").path("lastActiveOn").asText())
                .isEqualTo(TODAY.minusDays(55).toString());
        // An exact name beats a more recent page, accents aside.
        assertThat(flatCodes(read(activePages(marker + " Veteran").param("kind", "PLAYER"))).getFirst())
                .isEqualTo(marker + "-veteran-page");

        // A person is dated by their history, and in a team's picker those tied to that team come first.
        var history = List.of(Map.of("title", "Coach", "startsOn", TODAY.minusDays(900).toString(), "endsOn",
                TODAY.minusDays(880).toString(), "relatedPageId", clubPage.path("id").asText()));
        var person = new HashMap<String, Object>(Map.of("name", marker + " Former", "personRoles", List.of("COACH"),
                "history", history));
        page("PERSON", marker + "-former", null, person);
        page("PERSON", marker + "-current", null, Map.of("name", marker + " Current", "personRoles", List.of("COACH"),
                "history", List.of(Map.of("title", "Coach", "endsOn", TODAY.plusDays(3).toString()))));
        page("PERSON", marker + "-undated", null, Map.of("name", marker + " Undated", "personRoles", List.of("COACH"),
                "history", List.of(Map.of("title", "Coach"))));

        var people = read(activePages(marker).param("personRole", "COACHING"));
        assertThat(flatCodes(people)).containsExactly(marker + "-current", marker + "-former", marker + "-undated");
        assertThat(entry(people, marker + "-current").path("lastActiveOn").asText()).isEqualTo(TODAY.toString());
        var related = read(activePages(marker).param("personRole", "COACHING")
                .param("relatedPageId", clubPage.path("id").asText()));
        assertThat(flatCodes(related).getFirst()).isEqualTo(marker + "-former");
        assertThat(entry(related, marker + "-former").path("related").asBoolean()).isTrue();
        assertThat(entry(related, marker + "-current").has("related")).isFalse();

        // Other orders and the public lists do not carry these fields.
        var byName = read(get(ADMIN + "/pages").param("q", marker).param("sort", "NAME").param("kind", "PLAYER"));
        assertThat(byName.path("items").get(0).has("lastActiveOn")).isFalse();
    }

    private String marker(String prefix) {
        return prefix + UUID.randomUUID().toString().substring(0, 8);
    }

    private int rank(String status, String startsOn, String endsOn, Integer year) {
        return sql.queryForObject("""
            SELECT tournament.recency_rank(?, CAST(? AS date), CAST(? AS date), CAST(? AS integer), DATE '2026-11-07')
            """, Integer.class, status, startsOn, endsOn, year);
    }

    private int distance(String startsOn, String endsOn, Integer year) {
        return sql.queryForObject("""
            SELECT tournament.recency_distance(CAST(? AS date), CAST(? AS date), CAST(? AS integer), DATE '2026-11-07')
            """, Integer.class, startsOn, endsOn, year);
    }

    private int match(String query, String names) {
        return sql.queryForObject("SELECT tournament.name_match_rank(tournament.search_key(?), ?)", Integer.class,
                query, names);
    }

    private String documentDate(String value) {
        return sql.queryForObject("SELECT CAST(tournament.document_date(CAST(? AS jsonb)) AS text)", String.class,
                value);
    }

    private UUID tournament(String marker, String label, int startsIn, int endsIn) throws Exception {
        var content = new Tournament(marker + "-" + label, marker + " " + label, "VN",
                TODAY.plusDays(startsIn).getYear(),
                TODAY.plusDays(startsIn), TODAY.plusDays(endsIn), null, null);
        return id(create("tournaments", content));
    }

    private UUID part(String marker, String label, UUID mainEvent, int startsIn, int endsIn) throws Exception {
        var content = new Tournament(marker + "-" + label, marker + " " + label, "VN",
                TODAY.plusDays(startsIn).getYear(), TODAY.plusDays(startsIn), TODAY.plusDays(endsIn), null, null, null,
                null, CompetitionType.QUALIFIER, null, null, null, null, null, null, null, mainEvent);
        return id(create("tournaments", content));
    }

    private void organizedBy(UUID tournament, JsonNode organizer) throws Exception {
        send(put(ADMIN + "/competitions/" + tournament),
                Map.of("version", 0, "content", Map.of("organizerPageId", organizer.path("id").asText())));
    }

    private static int seasonsOf(JsonNode stats, JsonNode page) {
        for (var row : stats) {
            if (row.path("pageId").asText().equals(page.path("id").asText())) {
                return row.path("tournaments").asInt();
            }
        }
        throw new AssertionError("No statistics for page " + page.path("id").asText());
    }

    private UUID team(String marker, String label) throws Exception {
        return id(create("teams", new Team(marker + "-" + label, marker + " " + label, null, null, null)));
    }

    private UUID player(String marker, String label) throws Exception {
        return id(create("players", new Player(marker + "-" + label, marker + " " + label, null, null)));
    }

    private JsonNode series(UUID tournament, UUID teamA, UUID teamB, LocalDate day, boolean decided) throws Exception {
        var code = "series-" + UUID.randomUUID();
        var result = decided
                ? new SeriesResult(2, 0, "https://example.com/result", Verification.PRIMARY, TODAY)
                : null;
        Instant scheduledAt = day == null ? null : day.atTime(12, 0).toInstant(ZoneOffset.UTC);
        var name = read(get(ADMIN + "/tournaments/" + tournament)).path("content").path("name").asText();
        return send(post(ADMIN + "/series"), Map.of("content", new Series(code, tournament, name + " match", null,
                teamA, teamB, 3, scheduledAt, null, null, result)));
    }

    private void roster(UUID tournament, UUID team, UUID player, RosterStatus status) throws Exception {
        send(post(ADMIN + "/roster-memberships"), Map.of("content", new RosterMembership(tournament, team, player,
                null, null, status, null, null, null, null, null, null)));
    }

    private JsonNode page(String kind, String code, UUID entityId, Map<String, ?> content) throws Exception {
        var body = new HashMap<String, Object>(Map.of("kind", kind, "code", code, "content", content));
        if (entityId != null) {
            body.put("entityId", entityId);
        }
        return send(post(ADMIN + "/pages"), body);
    }

    private MockHttpServletRequestBuilder activePages(String q) {
        return get(ADMIN + "/pages").param("q", q).param("sort", "ACTIVE").param("size", "20");
    }

    private JsonNode tournaments(String q) throws Exception {
        return read(get(ADMIN + "/tournaments").param("q", q).param("size", "50"));
    }

    private List<String> walk(String path, String q) throws Exception {
        var seen = new ArrayList<String>();
        for (int page = 0; page < 10; page++) {
            var rows = read(get(ADMIN + path).param("q", q).param("page", String.valueOf(page)).param("size", "2"));
            if (rows.path("items").isEmpty()) {
                break;
            }
            seen.addAll(contentCodes(rows));
        }
        return seen;
    }

    private JsonNode create(String kind, Object content) throws Exception {
        return send(post(ADMIN + "/" + kind), Map.of("content", content));
    }

    private JsonNode read(MockHttpServletRequestBuilder request) throws Exception {
        return json.readTree(mvc.perform(authorized(request)).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString());
    }

    private void authorizedFails(MockHttpServletRequestBuilder request) throws Exception {
        mvc.perform(authorized(request)).andExpect(status().isBadRequest());
    }

    private JsonNode send(MockHttpServletRequestBuilder request, Object body) throws Exception {
        var response = mvc.perform(authorized(request).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andExpect(status().isOk()).andReturn().getResponse();
        return json.readTree(response.getContentAsString());
    }

    private static MockHttpServletRequestBuilder authorized(MockHttpServletRequestBuilder request) {
        return request.with(jwt().jwt(jwt -> jwt.subject("test-editor").issuer("https://issuer.example")).authorities(
                new SimpleGrantedAuthority("tournament:read"), new SimpleGrantedAuthority("tournament:write"),
                new SimpleGrantedAuthority("tournament:publish")));
    }

    private static List<String> contentCodes(JsonNode rows) {
        var codes = new ArrayList<String>();
        rows.path("items").forEach(row -> codes.add(row.path("content").path("code").asText()));
        return codes;
    }

    private static List<String> flatCodes(JsonNode rows) {
        var codes = new ArrayList<String>();
        rows.path("items").forEach(row -> codes.add(row.path("code").asText()));
        return codes;
    }

    private static List<String> ids(JsonNode rows) {
        var values = new ArrayList<String>();
        rows.path("items").forEach(row -> values.add(row.path("id").asText()));
        return values;
    }

    private static String activeOn(JsonNode rows, String code) {
        for (var row : rows.path("items")) {
            if (row.path("content").path("code").asText().equals(code)) {
                return row.has("lastActiveOn") ? row.path("lastActiveOn").asText() : null;
            }
        }
        throw new AssertionError("No row " + code);
    }

    private static JsonNode entry(JsonNode rows, String code) {
        for (var row : rows.path("items")) {
            if (row.path("code").asText().equals(code)) {
                return row;
            }
        }
        throw new AssertionError("No row " + code);
    }

    private static UUID id(JsonNode view) {
        return UUID.fromString(view.path("id").asText());
    }
}
