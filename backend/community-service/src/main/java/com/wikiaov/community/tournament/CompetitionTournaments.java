package com.wikiaov.community.tournament;

import java.util.Collection;
import java.util.Set;
import java.util.UUID;

/** Tournaments that profile pages name in their history and achievements. */
public interface CompetitionTournaments {
    /** The ids among {@code ids} that name a tournament, including one in the trash. */
    Set<UUID> known(Collection<UUID> ids);
}
