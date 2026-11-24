package com.wikiaov.community.tournament;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Individual profile pages, people and players, that tournaments and matches name for their broadcast and staff. */
public interface CompetitionPeople {
    /**
     * The individual pages among {@code pageIds}; an id that names no page, or a page of another kind, is left out.
     * With {@code published}, a published page is read as published; a page that is not published keeps its draft
     * name and has no code, so readers meet it through the competitions that name it.
     */
    Map<UUID, Person> read(Collection<UUID> pageIds, boolean published);

    /** A person has no picture here: {@code avatarUrl} of older snapshots is read and dropped. */
    record Person(
            UUID id,
            @Nullable String code,
            String name,
            @Nullable String avatarUrl,
            boolean published
    ) {
        public Person {
            avatarUrl = null;
        }
    }
}
