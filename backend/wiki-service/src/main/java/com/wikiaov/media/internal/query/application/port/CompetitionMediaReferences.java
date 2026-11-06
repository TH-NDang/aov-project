package com.wikiaov.media.internal.query.application.port;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Reads which images the community service names; that data lives in its database, not in a usage provider. */
public interface CompetitionMediaReferences {

    /** Records naming each image; empty when the service is unreachable or the actor may not read tournaments. */
    Optional<Map<UUID, Long>> references();
}
