package com.wikiaov.platform;

import com.wikiaov.platform.internal.domain.CatalogSnapshotSelector;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.ToLongFunction;

/** Shared read-selection contract; catalogs retain ownership of persistence and authorization. */
public final class CatalogSnapshots {
    private CatalogSnapshots() {
    }

    public record Snapshot<T>(
            UUID id,
            UUID ownerId,
            UUID patchVariantId,
            long revisionNo,
            String state,
            String cause,
            T value
    ) {
    }

    public record Change(
            UUID ownerId,
            UUID patchVariantId,
            boolean removed
    ) {
    }

    public static <T> List<Snapshot<T>> changedAt(List<Snapshot<T>> candidates, Set<UUID> selectedPatches,
            Set<UUID> explicitTargets) {
        return CatalogSnapshotSelector.changedAt(candidates, selectedPatches, explicitTargets);
    }

    public static <T> List<Snapshot<T>> carriedForward(List<Snapshot<T>> candidates, Set<UUID> selectedPatches,
            Set<UUID> applicablePatches, List<Change> changes, ToLongFunction<UUID> ordinal) {
        return CatalogSnapshotSelector.carriedForward(candidates, selectedPatches, applicablePatches, changes, ordinal);
    }

    public static <T> Map<UUID, T> latestByOwner(List<Snapshot<T>> candidates, ToLongFunction<UUID> ordinal) {
        return CatalogSnapshotSelector.latestByOwner(candidates, ordinal);
    }
}
