package com.wikiaov.community.tournament;

import java.util.UUID;

/** External references that keep competition identities and media available. */
public interface CompetitionReferences {
    long identityReferences(String kind, UUID id);

    long mediaReferences(UUID id);
}
