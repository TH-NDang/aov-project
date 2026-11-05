package com.wikiaov.community.tournament;

import java.util.UUID;

/** Stable editorial pages describing a competition across seasons. */
public interface CompetitionCircuits {
    Circuit read(UUID pageId, boolean published);

    record Circuit(
            UUID id,
            String code,
            String name,
            String logoUrl,
            boolean published
    ) {
    }
}
