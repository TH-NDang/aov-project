package com.wikiaov.community.tournament;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** The published profile pages a text can name beside competitions and those who take part in them. */
public interface CompetitionPages {
    /** What a page is about; a team or player page stands for a competition identity. */
    enum Kind {
        ORGANIZATION,
        CIRCUIT,
        TEAM,
        PLAYER,
        PERSON
    }

    /** Every published page, without the pages of teams and players in the trash. */
    List<NamedPage> published();

    /** The players behind the pages among {@code pageIds}, published or not; a page of no player is left out. */
    Map<UUID, UUID> players(Collection<UUID> pageIds);

    /** A text that changes whenever {@link #published()} answers differently, read without loading a page. */
    String revision();

    /** {@code summary} is the first paragraph of the introduction; a page about one person has neither it nor a logo. */
    record NamedPage(
            UUID id,
            Kind kind,
            String code,
            @Nullable UUID entityId,
            String name,
            @Nullable String shortName,
            @Nullable String country,
            @Nullable String logoUrl,
            @Nullable String summary
    ) {
    }
}
