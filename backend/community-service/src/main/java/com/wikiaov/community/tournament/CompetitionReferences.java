package com.wikiaov.community.tournament;

import java.util.List;
import java.util.UUID;

/** External references that keep competition identities and media available. */
public interface CompetitionReferences {
    /** What a reference count is asked about: a record of the tournament registry, or a page. */
    enum Subject {
        TEAM,
        PLAYER,
        TOURNAMENT,
        SERIES,
        ROSTER_MEMBERSHIP,
        GAME,
        PAGE
    }

    long identityReferences(Subject subject, UUID id);

    long mediaReferences(UUID id);

    /** One entry per record and image it names, in one read, so a whole image list can be answered at once. */
    List<String> allMediaReferences();
}
