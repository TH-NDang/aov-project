package com.wikiaov.community.tournament.internal.roster.application;

import com.wikiaov.community.tournament.internal.application.TournamentViews.View;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.RosterMembership;
import java.util.List;
import java.util.UUID;

/** Roster lines to add, change and take out in one write. */
public record RosterBatch(
        List<RosterMembership> create,
        List<Change> update,
        List<Removal> remove
) {
    public RosterBatch {
        create = create == null ? List.of() : List.copyOf(create);
        update = update == null ? List.of() : List.copyOf(update);
        remove = remove == null ? List.of() : List.copyOf(remove);
    }

    public record Change(
            UUID id,
            Long version,
            RosterMembership content
    ) {
    }

    public record Removal(
            UUID id,
            Long version
    ) {
    }

    /** The lines as stored after the write, and how many were taken out. */
    public record Result(
            List<View<RosterMembership>> created,
            List<View<RosterMembership>> updated,
            int removed
    ) {
    }

    public int size() {
        return create.size() + update.size() + remove.size();
    }
}
