package com.wikiaov.platform.internal.domain;

import com.wikiaov.platform.CatalogSnapshots.Change;
import com.wikiaov.platform.CatalogSnapshots.Snapshot;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.ToLongFunction;
import java.util.stream.Collectors;

/** Pure selection rules shared by the revision-based catalogs. No persistence or framework dependencies. */
public final class CatalogSnapshotSelector {
    private static final Set<String> GAMEPLAY_CAUSES = Set.of("DATA_BASELINE", "GAME_PATCH");

    private CatalogSnapshotSelector() {
    }

    public static <T> List<Snapshot<T>> changedAt(List<Snapshot<T>> candidates, Set<UUID> selectedPatches,
            Set<UUID> explicitTargets) {
        Map<UUID, Set<UUID>> recordedPatches = new HashMap<>();
        for (var candidate : candidates) {
            if (selectedPatches.contains(candidate.patchVariantId()) && GAMEPLAY_CAUSES.contains(candidate.cause())) {
                recordedPatches.computeIfAbsent(candidate.ownerId(), ignored -> new HashSet<>())
                        .add(candidate.patchVariantId());
            }
        }
        return candidates.stream()
                .filter(candidate -> explicitTargets.contains(candidate.id())
                        || candidate.patchVariantId() != null
                                && recordedPatches.getOrDefault(candidate.ownerId(), Set.of())
                                        .contains(candidate.patchVariantId()))
                .toList();
    }

    public static <T> List<Snapshot<T>> carriedForward(List<Snapshot<T>> candidates, Set<UUID> selectedPatches,
            Set<UUID> applicablePatches, List<Change> changes, ToLongFunction<UUID> ordinal) {
        Map<UUID, Change> latestChanges = changes.stream()
                .filter(change -> applicablePatches.contains(change.patchVariantId()))
                .collect(Collectors.toMap(Change::ownerId, change -> change,
                        (first, second) -> ordinal.applyAsLong(first.patchVariantId())
                                >= ordinal.applyAsLong(second.patchVariantId()) ? first : second));
        return candidates.stream()
                .filter(candidate -> candidate.state().equals("PUBLISHED")
                        && applicablePatches.contains(candidate.patchVariantId()))
                .filter(candidate -> survivesRemoval(candidate, latestChanges.get(candidate.ownerId()),
                        selectedPatches, ordinal))
                .toList();
    }

    private static boolean survivesRemoval(Snapshot<?> candidate, Change latestChange, Set<UUID> selectedPatches,
            ToLongFunction<UUID> ordinal) {
        return latestChange == null || !latestChange.removed()
                || selectedPatches.contains(latestChange.patchVariantId())
                || ordinal.applyAsLong(candidate.patchVariantId()) > ordinal.applyAsLong(latestChange.patchVariantId());
    }

    public static <T> Map<UUID, T> latestByOwner(List<Snapshot<T>> candidates, ToLongFunction<UUID> ordinal) {
        Map<UUID, Long> ordinals = new HashMap<>();
        Map<UUID, Snapshot<T>> selected = new HashMap<>();
        for (var candidate : candidates) {
            selected.merge(candidate.ownerId(), candidate,
                    (first, second) -> compare(first, second, ordinals, ordinal) >= 0 ? first : second);
        }
        return selected.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, entry -> entry.getValue().value()));
    }

    private static int compare(Snapshot<?> first, Snapshot<?> second, Map<UUID, Long> ordinals,
            ToLongFunction<UUID> ordinal) {
        int comparison = Long.compare(ordinal(first.patchVariantId(), ordinals, ordinal),
                ordinal(second.patchVariantId(), ordinals, ordinal));
        return comparison != 0 ? comparison : Long.compare(first.revisionNo(), second.revisionNo());
    }

    private static long ordinal(UUID patchId, Map<UUID, Long> ordinals, ToLongFunction<UUID> resolver) {
        return patchId == null ? 0 : ordinals.computeIfAbsent(patchId, resolver::applyAsLong);
    }
}
