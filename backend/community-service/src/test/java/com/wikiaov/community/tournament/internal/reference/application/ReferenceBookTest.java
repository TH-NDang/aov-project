package com.wikiaov.community.tournament.internal.reference.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.tournament.CompetitionPages;
import com.wikiaov.community.tournament.CompetitionPages.NamedPage;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TournamentTier;
import com.wikiaov.community.tournament.internal.reference.application.ReferenceViews.Name;
import com.wikiaov.community.tournament.internal.reference.domain.PublishedCompetition;
import com.wikiaov.community.tournament.internal.reference.domain.PublishedCompetition.Circuit;
import com.wikiaov.community.tournament.internal.reference.domain.PublishedCompetition.Duty;
import com.wikiaov.community.tournament.internal.reference.domain.PublishedCompetition.Event;
import com.wikiaov.community.tournament.internal.reference.domain.PublishedCompetition.Person;
import com.wikiaov.community.tournament.internal.reference.domain.PublishedCompetition.Player;
import com.wikiaov.community.tournament.internal.reference.domain.PublishedCompetition.Seat;
import com.wikiaov.community.tournament.internal.reference.domain.PublishedCompetition.Team;
import com.wikiaov.community.tournament.internal.reference.domain.ReferenceKind;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ReferenceBookTest {
    private static final UUID CIRCUIT = UUID.randomUUID();
    private static final UUID TEAM = UUID.randomUUID();
    private static final UUID OTHER_TEAM = UUID.randomUUID();
    private static final UUID PLAYER = UUID.randomUUID();
    private static final UUID PERSON_PAGE = UUID.randomUUID();

    @Test
    void aTeamIsNamedByItsNewestCompetitionAndKeepsItsOlderNames() {
        var older = competition(2024, Map.of(TEAM, team("Marines Esports", "ME")), Map.of(), List.of());
        var newer = competition(2026, Map.of(TEAM, team("GAM Esports", "GAM")), Map.of(), List.of());

        var book = ReferenceBook.of(List.of(older, newer), List.of(), Map.of(), Map.of());

        assertThat(book.names(List.of(ReferenceKind.TEAM))).containsExactly(new Name(TEAM, ReferenceKind.TEAM,
                "GAM Esports", "GAM", List.of("Marines Esports", "gam"), "/teams/" + TEAM, null, List.of()));
        assertThat(book.preview(ReferenceKind.TEAM, TEAM).competitions()).isEqualTo(2);
        assertThat(book.preview(ReferenceKind.TEAM, TEAM).latest().competition()).isEqualTo("Cup 2026");
    }

    @Test
    void aPublishedPageGivesATeamItsNameAndItsAddress() {
        var played = competition(2026, Map.of(TEAM, team("GAM Esports", "GAM")), Map.of(), List.of());
        var page = new NamedPage(UUID.randomUUID(), CompetitionPages.Kind.TEAM, "gam", TEAM, "GAM", null, "VN", null,
                "A team.");

        var name = ReferenceBook.of(List.of(played), List.of(page), Map.of(), Map.of())
                .names(List.of(ReferenceKind.TEAM))
                .getFirst();

        assertThat(name.name()).isEqualTo("GAM");
        assertThat(name.path()).isEqualTo("/pages/gam");
        assertThat(name.aliases()).containsExactly("GAM Esports", "gam");
    }

    @Test
    void aPlayerCarriesEveryTeamWithTheLatestFirstAndNoPartOfTheRealName() {
        var player = new Player("XB", List.of("Xuân Bách", "XBeo"), "VN");
        var older = competition(2024, Map.of(OTHER_TEAM, team("Old", "OLD")), Map.of(PLAYER, player),
                List.of(new Seat(PLAYER, OTHER_TEAM)));
        var newer = competition(2026, Map.of(TEAM, team("New", "NEW")), Map.of(PLAYER, player),
                List.of(new Seat(PLAYER, TEAM)));

        var book = ReferenceBook.of(List.of(older, newer), List.of(), Map.of(),
                Map.of(PLAYER, "Nguyễn Xuân Bách"));

        assertThat(book.names(List.of(ReferenceKind.PLAYER))).containsExactly(new Name(PLAYER, ReferenceKind.PLAYER,
                "XB", null, List.of("XBeo"), "/players/" + PLAYER, null, List.of(TEAM, OTHER_TEAM)));
        assertThat(book.preview(ReferenceKind.PLAYER, PLAYER).latest().team().name()).isEqualTo("New");
    }

    @Test
    void someoneWhoPlaysAndCastsStandsOnceAsThePlayer() {
        var player = new Player("XB", List.of(), "VN");
        var played = withPeople(2026, Map.of(PLAYER, player), Map.of(PERSON_PAGE, new Person("XB")),
                List.of(new Duty(PERSON_PAGE, "CASTER", null)));

        var book = ReferenceBook.of(List.of(played), List.of(), Map.of(PERSON_PAGE, PLAYER), Map.of());

        assertThat(book.names(ReferenceKind.INDIVIDUALS)).extracting(Name::kind).containsExactly(ReferenceKind.PLAYER);
    }

    @Test
    void aPersonShowsWhatTheyDidInTheNewestCompetitionAndNoPicture() {
        var older = withPeople(2024, Map.of(), Map.of(PERSON_PAGE, new Person("Tony")),
                List.of(new Duty(PERSON_PAGE, "HOST", null)));
        var newer = withPeople(2026, Map.of(), Map.of(PERSON_PAGE, new Person("Tony")),
                List.of(new Duty(PERSON_PAGE, "CASTER", null)));

        var preview = ReferenceBook.of(List.of(older, newer), List.of(), Map.of(), Map.of()).preview(
                ReferenceKind.PERSON,
                PERSON_PAGE);

        assertThat(preview.path()).isEqualTo("/people/" + PERSON_PAGE);
        assertThat(preview.latest().roles()).containsExactly("CASTER");
        assertThat(preview.logoUrl()).isNull();
    }

    @Test
    void aCompetitionCarriesItsCircuitAndTheCircuitCountsItsSeasons() {
        var page = new NamedPage(CIRCUIT, CompetitionPages.Kind.CIRCUIT, "rpl", null, "RoV Pro League", "RPL", null,
                null, "The top league of Thailand.");
        var seasons = List.of(competition(2025, Map.of(), Map.of(), List.of()),
                competition(2026, Map.of(), Map.of(), List.of()));

        var book = ReferenceBook.of(seasons, List.of(page), Map.of(), Map.of());

        assertThat(book.names(List.of(ReferenceKind.COMPETITION))).extracting(Name::circuitId)
                .containsExactly(CIRCUIT, CIRCUIT);
        assertThat(book.preview(ReferenceKind.CIRCUIT, CIRCUIT).competitions()).isEqualTo(2);
        assertThat(book.preview(ReferenceKind.CIRCUIT, CIRCUIT).summary()).isEqualTo("The top league of Thailand.");
        assertThat(book.preview(ReferenceKind.COMPETITION, seasons.getFirst().id()).event().circuit())
                .isEqualTo("RoV Pro League");
    }

    @Test
    void aShortNameThatIsAlsoANicknameIsLeftOutOfTheListAndStaysOnThePreview() {
        var player = new Player("LYL", List.of(), null);
        var played = competition(2026, Map.of(TEAM, team("LiveYourLife", "LYL")), Map.of(PLAYER, player), List.of());

        var book = ReferenceBook.of(List.of(played), List.of(), Map.of(), Map.of());

        assertThat(book.names(List.of(ReferenceKind.TEAM)).getFirst().shortName()).isNull();
        assertThat(book.preview(ReferenceKind.TEAM, TEAM).shortName()).isEqualTo("LYL");
    }

    @Test
    void aTeamNamedLikeACircuitIsTheSeatOfItsRepresentativeAndIsNotNamed() {
        var circuit = new NamedPage(CIRCUIT, CompetitionPages.Kind.CIRCUIT, "rpl", null, "RoV Pro League", "RPL", null,
                null, null);
        var played = competition(2026, Map.of(TEAM, team("RoV Pro League", "RPL"), OTHER_TEAM,
                team("Thai seat", "rpl")), Map.of(), List.of());

        var book = ReferenceBook.of(List.of(played), List.of(circuit), Map.of(), Map.of());

        assertThat(book.names(List.of(ReferenceKind.TEAM))).isEmpty();
        assertThat(book.names(List.of(ReferenceKind.CIRCUIT))).hasSize(1);
    }

    @Test
    void aRecordIsFoundOnlyUnderItsOwnKind() {
        var played = competition(2026, Map.of(TEAM, team("GAM Esports", "GAM")), Map.of(), List.of());

        var book = ReferenceBook.of(List.of(played), List.of(), Map.of(), Map.of());

        assertThat(book.preview(ReferenceKind.PLAYER, TEAM)).isNull();
    }

    private static Team team(String name, String shortName) {
        return new Team(name, shortName, List.of("gam"), "VN", "https://img.example/logo.png", null);
    }

    private static PublishedCompetition competition(int year, Map<UUID, Team> teams, Map<UUID, Player> players,
            List<Seat> rosters) {
        return new PublishedCompetition(UUID.randomUUID(), event(year, List.of()), new Circuit(CIRCUIT,
                "RoV Pro League"), teams, players, Map.of(), rosters, List.of());
    }

    private static PublishedCompetition withPeople(int year, Map<UUID, Player> players, Map<UUID, Person> people,
            List<Duty> broadcast) {
        return new PublishedCompetition(UUID.randomUUID(), event(year, broadcast), null, Map.of(), players, people,
                List.of(), List.of());
    }

    private static Event event(int year, List<Duty> broadcast) {
        return new Event("Cup " + year, "VN", TournamentTier.S, LocalDate.of(year, 1, 31), null, null, null, List.of(),
                broadcast);
    }
}
