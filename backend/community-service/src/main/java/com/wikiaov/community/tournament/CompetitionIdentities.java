package com.wikiaov.community.tournament;

import java.util.UUID;

public interface CompetitionIdentities {
    record Identity(
            UUID id,
            String code,
            String name,
            String country,
            String imageUrl
    ) {
    }

    Identity read(String kind, UUID id);

    Identity create(String kind, String code, String name, String country, String imageUrl, String actor);

    void publish(String kind, UUID id, String name, String shortName, String country, String imageUrl, String actor);
}
