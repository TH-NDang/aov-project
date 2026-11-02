package com.wikiaov.community.tournament;

import java.util.UUID;

public interface CompetitionOrganizations {
    Organization read(UUID pageId, boolean published);

    record Organization(
            UUID id,
            String code,
            String name,
            String logoUrl,
            boolean published
    ) {
    }
}
