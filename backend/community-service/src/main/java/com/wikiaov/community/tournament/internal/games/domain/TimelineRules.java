package com.wikiaov.community.tournament.internal.games.domain;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.GameTimeline;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Seat;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Side;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TimelineEvent;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.VodPause;
import java.util.HashSet;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** The broadcast pauses and the kills, objectives and notes observed on the game clock. */
final class TimelineRules {
    static final int MAX_PAUSES = 50;
    static final int MAX_TIMELINE_EVENTS = 1000;
    /** Longest pause of a game, six hours. */
    static final int MAX_PAUSE_SECONDS = 21_600;
    static final int MAX_ASSISTS = GameRules.PLAYERS_PER_SIDE - 1;
    static final int MAX_EVENT_NOTE = 500;
    static final int MAX_EVENT_TITLE = 120;

    private TimelineRules() {
    }

    static void check(GameTimeline timeline, @Nullable Integer duration, List<String> errors) {
        if (timeline.pauses().size() > MAX_PAUSES || timeline.events().size() > MAX_TIMELINE_EVENTS) {
            errors.add("timeline.maximum");
            return;
        }
        pauses(timeline.pauses(), duration, errors);
        events(timeline.events(), duration, errors);
    }

    private static void pauses(List<VodPause> pauses, @Nullable Integer duration, List<String> errors) {
        int previous = -1;
        for (int index = 0; index < pauses.size(); index++) {
            var pause = pauses.get(index);
            String field = "timeline.pauses[" + index + "]";
            GameSeconds.moment(pause.atSeconds(), duration, field, errors);
            if (pause.atSeconds() != null) {
                if (pause.atSeconds() <= previous) {
                    errors.add(field + ".time.order");
                }
                previous = pause.atSeconds();
            }
            if (pause.durationSeconds() == null || pause.durationSeconds() < 1
                    || pause.durationSeconds() > MAX_PAUSE_SECONDS) {
                errors.add(field + ".durationSeconds.range");
            }
        }
    }

    private static void events(List<TimelineEvent> events, @Nullable Integer duration, List<String> errors) {
        var ids = new HashSet<String>();
        int previous = -1;
        for (int index = 0; index < events.size(); index++) {
            var event = events.get(index);
            String field = "timeline.events[" + index + "]";
            if (event.id() == null || !event.id().matches("[A-Za-z0-9:_-]{1,64}")) {
                errors.add(field + ".id");
            } else if (!ids.add(event.id())) {
                errors.add(field + ".id.duplicate");
            }
            GameSeconds.moment(event.atSeconds(), duration, field, errors);
            if (event.atSeconds() != null) {
                if (event.atSeconds() < previous) {
                    errors.add(field + ".time.order");
                }
                previous = event.atSeconds();
            }
            if (event.note() != null && event.note().length() > MAX_EVENT_NOTE) {
                errors.add(field + ".note.length");
            }
            if (event.kind() == null) {
                errors.add(field + ".kind");
                continue;
            }
            switch (event.kind()) {
                case KILL -> kill(event, field, errors);
                case OBJECTIVE -> objective(event, field, errors);
                case NOTE -> note(event, field, errors);
            }
        }
    }

    private static void kill(TimelineEvent event, String path, List<String> errors) {
        if (event.side() != null || event.objective() != null || event.by() != null || event.title() != null) {
            errors.add(path + ".fields.unexpected");
        }
        if (event.killer() == null && event.victim() == null) {
            errors.add(path + ".kill.participant");
            return;
        }
        seat(event.killer(), path + ".killer", errors);
        seat(event.victim(), path + ".victim", errors);
        if (event.killer() != null && event.victim() != null && event.killer().side() == event.victim().side()) {
            errors.add(path + ".victim.sameSide");
        }
        Side scoring = event.killer() != null
                ? event.killer().side()
                : event.victim().side() == null ? null : event.victim().side() == Side.BLUE ? Side.RED : Side.BLUE;
        var assists = new HashSet<Seat>();
        if (event.assists().size() > MAX_ASSISTS) {
            errors.add(path + ".assists.maximum");
        }
        for (int index = 0; index < event.assists().size(); index++) {
            var assist = event.assists().get(index);
            String field = path + ".assists[" + index + "]";
            seat(assist, field, errors);
            if (assist == null) {
                continue;
            }
            if (!assists.add(assist) || assist.equals(event.killer())) {
                errors.add(field + ".duplicate");
            }
            if (scoring != null && assist.side() != scoring) {
                errors.add(field + ".side");
            }
        }
    }

    private static void objective(TimelineEvent event, String path, List<String> errors) {
        if (event.killer() != null || event.victim() != null || !event.assists().isEmpty() || event.title() != null) {
            errors.add(path + ".fields.unexpected");
        }
        if (event.side() == null) {
            errors.add(path + ".side");
        }
        if (event.objective() == null) {
            errors.add(path + ".objective");
        }
        if (event.by() != null) {
            seat(event.by(), path + ".by", errors);
            if (event.side() != null && event.by().side() != event.side()) {
                errors.add(path + ".by.side");
            }
        }
    }

    private static void note(TimelineEvent event, String path, List<String> errors) {
        if (event.killer() != null || event.victim() != null || !event.assists().isEmpty()
                || event.objective() != null || event.by() != null) {
            errors.add(path + ".fields.unexpected");
        }
        if (event.title() == null || event.title().isBlank() || event.title().length() > MAX_EVENT_TITLE) {
            errors.add(path + ".title");
        }
    }

    private static void seat(@Nullable Seat seat, String path, List<String> errors) {
        if (seat != null && (seat.side() == null || seat.lane() == null)) {
            errors.add(path);
        }
    }
}
