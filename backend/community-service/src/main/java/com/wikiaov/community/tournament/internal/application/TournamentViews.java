package com.wikiaov.community.tournament.internal.application;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.persistence.VersionedRecord;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

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

    /**
     * A row of a ranked list with what explains its place: the day of its last activity and how it relates to the
     * context the picker was opened in. Both are left out when they do not apply.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Ranked<T>(
            @JsonUnwrapped View<T> view,
            LocalDate lastActiveOn,
            String context
    ) {
        public static <T> PageSlice<Ranked<T>> unranked(PageSlice<View<T>> page) {
            return page.map(row -> new Ranked<>(row, null, null));
        }
    }

    public record TournamentStats(
            UUID tournamentId,
            long teams,
            long matches,
            long played
    ) {
    }

    public static <T> View<T> view(VersionedRecord row, T content) {
        return new View<>(row.getId(), row.getVersion(), row.getCreatedAt(), row.getUpdatedAt(), content, List.of(),
                null, row.getDeletedAt());
    }
}
