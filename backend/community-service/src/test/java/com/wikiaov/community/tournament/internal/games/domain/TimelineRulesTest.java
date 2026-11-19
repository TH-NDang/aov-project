package com.wikiaov.community.tournament.internal.games.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.tournament.internal.domain.GameContent.GameTimeline;
import com.wikiaov.community.tournament.internal.domain.GameContent.ObjectiveKind;
import com.wikiaov.community.tournament.internal.domain.GameContent.Seat;
import com.wikiaov.community.tournament.internal.domain.GameContent.Side;
import com.wikiaov.community.tournament.internal.domain.GameContent.TimelineEvent;
import com.wikiaov.community.tournament.internal.domain.GameContent.TimelineKind;
import com.wikiaov.community.tournament.internal.domain.GameContent.VodPause;
import com.wikiaov.community.tournament.internal.domain.RosterContent.Lane;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class TimelineRulesTest {
    private static final Seat BLUE_TOP = new Seat(Side.BLUE, Lane.TOP);
    private static final Seat RED_MID = new Seat(Side.RED, Lane.MID);

    @Test
    void aTimelineOfMoreThanFiftyPausesIsRejectedWithoutCheckingEachPause() {
        var pauses = IntStream.range(0, 51).mapToObj(index -> new VodPause(null, null)).toList();

        assertThat(violations(new GameTimeline(pauses, List.of()))).containsExactly("timeline.maximum");
    }

    @Test
    void anEventNoteHoldsAtMostFiveHundredCharacters() {
        var note = new TimelineEvent("n1", 10, TimelineKind.NOTE, null, null, null, null, null, null, "Fight",
                "x".repeat(501));

        assertThat(violations(events(note))).containsExactly("timeline.events[0].note.length");
    }

    @Test
    void aKillHasAtMostFourAssists() {
        var assists = List.of(new Seat(Side.BLUE, Lane.JUNGLE), new Seat(Side.BLUE, Lane.MID),
                new Seat(Side.BLUE, Lane.DRAGON), new Seat(Side.BLUE, Lane.SUPPORT), new Seat(Side.BLUE, Lane.MID));
        var kill = new TimelineEvent("k1", 10, TimelineKind.KILL, BLUE_TOP, RED_MID, assists, null, null, null, null,
                null);

        assertThat(violations(events(kill))).contains("timeline.events[0].assists.maximum");
    }

    @Test
    void aKillerNamesBothTheSideAndTheLane() {
        var kill = new TimelineEvent("k1", 10, TimelineKind.KILL, new Seat(Side.BLUE, null), RED_MID, List.of(), null,
                null, null, null, null);

        assertThat(violations(events(kill))).containsExactly("timeline.events[0].killer");
    }

    @Test
    void aKillCarriesNoObjectiveOrNoteFields() {
        var kill = new TimelineEvent("k1", 10, TimelineKind.KILL, BLUE_TOP, RED_MID, List.of(), null,
                ObjectiveKind.TURRET, null, null, null);

        assertThat(violations(events(kill))).containsExactly("timeline.events[0].fields.unexpected");
    }

    @Test
    void aNoteCarriesNoKillOrObjectiveFields() {
        var note = new TimelineEvent("n1", 10, TimelineKind.NOTE, BLUE_TOP, null, null, null, null, null, "Fight",
                null);

        assertThat(violations(events(note))).containsExactly("timeline.events[0].fields.unexpected");
    }

    private static GameTimeline events(TimelineEvent event) {
        return new GameTimeline(List.of(), List.of(event));
    }

    private static List<String> violations(GameTimeline timeline) {
        var errors = new ArrayList<String>();
        TimelineRules.check(timeline, 600, errors);
        return errors;
    }
}
