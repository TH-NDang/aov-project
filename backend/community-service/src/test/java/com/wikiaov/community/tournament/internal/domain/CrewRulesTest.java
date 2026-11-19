package com.wikiaov.community.tournament.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.BroadcastRole;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.CrewMember;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.StaffMember;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.StaffRole;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CrewRulesTest {
    private final UUID person = UUID.randomUUID();
    private final UUID team = UUID.randomUUID();

    @Test
    void onePersonMayHoldTwoRolesButNotTheSameRoleTwice() {
        var twoRoles = List.of(new CrewMember(person, BroadcastRole.CASTER),
                new CrewMember(person, BroadcastRole.HOST));
        var repeated = List.of(new CrewMember(person, BroadcastRole.CASTER),
                new CrewMember(person, BroadcastRole.CASTER));

        assertThat(CrewRules.crew(twoRoles, CrewRules.MAX_SERIES_CREW, "broadcast")).isEmpty();
        assertThat(CrewRules.crew(repeated, CrewRules.MAX_SERIES_CREW, "broadcast"))
                .containsExactly("broadcast names the same person with the same role twice.");
    }

    @Test
    void aCrewLineNeedsAPageAndARole() {
        var incomplete = List.of(new CrewMember(null, BroadcastRole.CASTER), new CrewMember(person, null));

        assertThat(CrewRules.crew(incomplete, CrewRules.MAX_SERIES_CREW, "broadcast"))
                .containsExactly("broadcast entries need a pageId and a role.");
    }

    @Test
    void aCrewLongerThanItsLimitIsRefused() {
        var crowd = Collections.nCopies(CrewRules.MAX_SERIES_CREW + 1, (CrewMember) null);

        assertThat(CrewRules.crew(crowd, CrewRules.MAX_SERIES_CREW, "broadcast"))
                .contains("broadcast must not exceed " + CrewRules.MAX_SERIES_CREW + " people.");
    }

    @Test
    void aStaffLineNeedsATeamAndKeepsItsTitleShortAndUnrepeated() {
        var line = new StaffMember(team, person, StaffRole.COACH, null);
        var title = "x".repeat(CrewRules.MAX_STAFF_TITLE + 1);

        assertThat(CrewRules.staff(List.of(line, line)))
                .containsExactly("staff names the same person with the same role for one team twice.");
        assertThat(CrewRules.staff(List.of(new StaffMember(null, person, StaffRole.COACH, null))))
                .containsExactly("staff entries need a teamId, a pageId and a role.");
        assertThat(CrewRules.staff(List.of(new StaffMember(team, person, StaffRole.TEAM_ANALYST, title))))
                .containsExactly("staff.title must not exceed " + CrewRules.MAX_STAFF_TITLE + " characters.");
    }

    @Test
    void aBlankStaffTitleReadsAsNone() {
        assertThat(new StaffMember(team, person, StaffRole.COACH, "  ").title()).isNull();
    }

    @Test
    void aTournamentNamesEachPageOnceAcrossItsBroadcastAndStaff() {
        var coach = UUID.randomUUID();
        var tournament = new Tournament("code", "Name", "VN", null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, List.of(new CrewMember(person, BroadcastRole.CASTER)),
                List.of(new StaffMember(team, coach, StaffRole.COACH, null),
                        new StaffMember(team, person, StaffRole.TEAM_ANALYST, null)));

        assertThat(CrewRules.pageIds(tournament)).containsExactly(person, coach);
    }
}
