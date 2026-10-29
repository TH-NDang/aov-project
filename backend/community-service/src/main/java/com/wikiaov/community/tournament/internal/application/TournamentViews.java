package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.tournament.internal.persistence.VersionedRecord;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.Page;

public final class TournamentViews {
    private TournamentViews() {
    }

    public record Create<T>(
            T content
    ) {
    }

    public record Update<T>(
            Long version,
            T content
    ) {
    }

    public record Version(
            Long version
    ) {
    }

    public record View<T>(
            UUID id,
            long version,
            Instant createdAt,
            Instant updatedAt,
            T content,
            List<String> missingFields,
            Instant publishedAt,
            Instant deletedAt
    ) {
        public View(UUID id, long version, Instant createdAt, Instant updatedAt, T content,
                List<String> missingFields, Instant publishedAt) {
            this(id, version, createdAt, updatedAt, content, missingFields, publishedAt, null);
        }
    }

    public record PageSlice<T>(
            List<T> items,
            long totalElements,
            int page,
            int size
    ) {
        public static <T> PageSlice<T> from(Page<T> page) {
            return new PageSlice<>(page.getContent(), page.getTotalElements(), page.getNumber(), page.getSize());
        }
    }

    public static <T> View<T> view(VersionedRecord row, T content) {
        return new View<>(row.getId(), row.getVersion(), row.getCreatedAt(), row.getUpdatedAt(), content, List.of(),
                null, row.getDeletedAt());
    }
}
