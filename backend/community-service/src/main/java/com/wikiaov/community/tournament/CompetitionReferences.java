package com.wikiaov.community.tournament;

import java.util.List;
import java.util.UUID;

/** External references that keep competition identities and media available. */
public interface CompetitionReferences {
    long identityReferences(String kind, UUID id);

    long mediaReferences(UUID id);

    /** One entry per record and image it names, in one read, so a whole image list can be answered at once. */
    List<String> allMediaReferences();
}
