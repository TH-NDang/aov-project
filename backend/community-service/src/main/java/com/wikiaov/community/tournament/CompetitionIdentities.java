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

    Identity read(Kind kind, UUID id);

    Identity create(Kind kind, String code, String name, String country, String imageUrl, String actor);

    void publish(Kind kind, UUID id, String name, String shortName, String country, String imageUrl, String actor);
}
