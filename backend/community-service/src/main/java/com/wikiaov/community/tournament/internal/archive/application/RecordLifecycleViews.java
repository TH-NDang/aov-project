package com.wikiaov.community.tournament.internal.archive.application;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class RecordLifecycleViews {
    private RecordLifecycleViews() {
    }

    public record Usage(
            String type,
            long count,
            String adminPath
    ) {
    }

    public record Impact(
            UUID id,
            long version,
            Instant deletedAt,
            boolean canDelete,
            List<Usage> usages
    ) {
    }

    public record State(
            UUID id,
            long version,
            Instant deletedAt
    ) {
    }

    public enum Action {
        DELETE,
        RESTORE
    }
}
