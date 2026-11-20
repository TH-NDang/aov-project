package com.wikiaov.community.tournament;

import java.util.UUID;

public interface CompetitionIdentities {
    /** The competition identities a page can stand for. */
    enum Kind {
        TEAM,
        PLAYER
    }

    record Identity(
            UUID id,
            String code,
            String name,
            String country,
            String imageUrl
    ) {
    }

    /** What a published page tells the identity it stands for. */
    record Details(
            String name,
            String shortName,
            String country,
            String imageUrl
    ) {
    }

    Identity read(Kind kind, UUID id);

    /**
     * Creates the identity of a new page. Unless {@code allowSameName}, a player named like an active player of the
     * same country is refused, so an editor links the existing profile instead (spec 04).
     */
    Identity create(Kind kind, String code, String name, String country, String imageUrl, String actor,
            boolean allowSameName);

    void publish(Kind kind, UUID id, Details details, String actor);
}
