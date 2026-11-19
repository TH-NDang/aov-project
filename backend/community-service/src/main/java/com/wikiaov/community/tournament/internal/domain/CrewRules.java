package com.wikiaov.community.tournament.internal.domain;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.CrewMember;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.StaffMember;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

/** The broadcast crew and staff lines that tournaments and series name by profile page (spec 04, ADR-032). */
public final class CrewRules {
    public static final int MAX_TOURNAMENT_CREW = 64;
    public static final int MAX_SERIES_CREW = 16;
    public static final int MAX_STAFF = 256;
    public static final int MAX_STAFF_TITLE = 100;

    private CrewRules() {
    }

    /** Every person names a page and a role, and no person holds the same role twice. */
    public static List<String> crew(List<CrewMember> crew, int max, String field) {
        var errors = new LinkedHashSet<String>();
        if (crew.size() > max) {
            errors.add(field + " must not exceed " + max + " people.");
        }
        Set<List<String>> seen = new HashSet<>();
        for (var member : crew) {
            if (member == null || member.pageId() == null || member.role() == null) {
                errors.add(field + " entries need a pageId and a role.");
                continue;
            }
            if (!seen.add(List.of(member.pageId().toString(), member.role().name()))) {
                errors.add(field + " names the same person with the same role twice.");
            }
        }
        return List.copyOf(errors);
    }

    /** Every line names a team, a page and a role, with a short title, and no line repeats. */
    public static List<String> staff(List<StaffMember> staff) {
        var errors = new LinkedHashSet<String>();
        if (staff.size() > MAX_STAFF) {
            errors.add("staff must not exceed " + MAX_STAFF + " lines.");
        }
        Set<List<String>> seen = new HashSet<>();
        for (var member : staff) {
            if (member == null || member.teamId() == null || member.pageId() == null || member.role() == null) {
                errors.add("staff entries need a teamId, a pageId and a role.");
                continue;
            }
            if (member.title() != null && member.title().length() > MAX_STAFF_TITLE) {
                errors.add("staff.title must not exceed " + MAX_STAFF_TITLE + " characters.");
            }
            if (!seen.add(List.of(member.teamId().toString(), member.pageId().toString(), member.role().name()))) {
                errors.add("staff names the same person with the same role for one team twice.");
            }
        }
        return List.copyOf(errors);
    }

    /** The profile pages a tournament names for its broadcast and staff. */
    public static Set<UUID> pageIds(Tournament tournament) {
        return ids(Stream.concat(tournament.broadcast().stream().map(member -> member == null ? null : member.pageId()),
                tournament.staff().stream().map(member -> member == null ? null : member.pageId())));
    }

    /** The profile pages a series names for its broadcast. */
    public static Set<UUID> pageIds(Series series) {
        return ids(series.broadcast().stream().map(member -> member == null ? null : member.pageId()));
    }

    private static Set<UUID> ids(Stream<UUID> values) {
        var ids = new LinkedHashSet<UUID>();
        values.filter(Objects::nonNull).forEach(ids::add);
        return ids;
    }
}
