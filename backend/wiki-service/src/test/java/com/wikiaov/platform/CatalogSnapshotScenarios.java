package com.wikiaov.platform;

import com.wikiaov.platform.CatalogSnapshots.Change;
import com.wikiaov.platform.CatalogSnapshots.Snapshot;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Also executable with plain Java when Maven dependencies are unavailable. */
public final class CatalogSnapshotScenarios {
    private static final UUID OWNER = id(100);
    private static final UUID OTHER_OWNER = id(200);
    private static final UUID FIRST_PATCH = id(1);
    private static final UUID SECOND_PATCH = id(2);
    private static final UUID THIRD_PATCH = id(3);

    private CatalogSnapshotScenarios() {
    }

    public static void main(String[] args) {
        gameplayChangesIncludeCorrectionsButNotUnrelatedOwners();
        explicitTargetsIncludeLegacyUnplacedSnapshots();
        carriedForwardExcludesDraftsAndFuturePatches();
        removalsAreVisibleAtTheirPatchButNotLater();
        newerSnapshotsAndLaterChangesRestoreVisibility();
        snapshotOrderingUsesPatchThenRevisionAndKeepsFirstTie();
        latestSelectionCachesOrdinalsWithoutResolvingNull();
        randomizedSelectionMatchesPreviousCatalogAlgorithm();
        System.out.println("Catalog snapshot regression checks passed (8 scenarios, 2000 differential cases).");
    }

    static void gameplayChangesIncludeCorrectionsButNotUnrelatedOwners() {
        var baseline = snapshot(1, OWNER, FIRST_PATCH, 1, "PUBLISHED", "DATA_BASELINE");
        var correction = snapshot(2, OWNER, FIRST_PATCH, 2, "DRAFT", "CONTENT_CORRECTION");
        var unrelated = snapshot(3, OTHER_OWNER, FIRST_PATCH, 1, "PUBLISHED", "TRANSLATION_UPDATE");
        var future = snapshot(4, OWNER, SECOND_PATCH, 3, "PUBLISHED", "GAME_PATCH");
        equal(List.of(baseline, correction), CatalogSnapshots.changedAt(
                List.of(baseline, correction, unrelated, future), patches(FIRST_PATCH), Set.of()));
    }

    static void explicitTargetsIncludeLegacyUnplacedSnapshots() {
        var legacy = snapshot(1, OWNER, null, 1, "PUBLISHED", "DATA_BASELINE");
        var unrelated = snapshot(2, OTHER_OWNER, FIRST_PATCH, 1, "DRAFT", "CONTENT_CORRECTION");
        equal(List.of(legacy), CatalogSnapshots.changedAt(List.of(legacy, unrelated),
                patches(SECOND_PATCH), Set.of(legacy.id())));
        equal(List.of(), CatalogSnapshots.changedAt(List.of(legacy), patches(), Set.of()));
    }

    static void carriedForwardExcludesDraftsAndFuturePatches() {
        var published = snapshot(1, OWNER, FIRST_PATCH, 1, "PUBLISHED", "DATA_BASELINE");
        var draft = snapshot(2, OWNER, SECOND_PATCH, 2, "DRAFT", "GAME_PATCH");
        var future = snapshot(3, OWNER, THIRD_PATCH, 3, "PUBLISHED", "GAME_PATCH");
        var unplaced = snapshot(4, OTHER_OWNER, null, 1, "PUBLISHED", "DATA_BASELINE");
        equal(List.of(published), carry(List.of(published, draft, future, unplaced),
                patches(SECOND_PATCH), patches(FIRST_PATCH, SECOND_PATCH), List.of()));
    }

    static void removalsAreVisibleAtTheirPatchButNotLater() {
        var snapshot = snapshot(1, OWNER, FIRST_PATCH, 1, "PUBLISHED", "DATA_BASELINE");
        var removal = new Change(OWNER, SECOND_PATCH, true);
        var history = patches(FIRST_PATCH, SECOND_PATCH, THIRD_PATCH);
        equal(List.of(snapshot), carry(List.of(snapshot), patches(SECOND_PATCH), history, List.of(removal)));
        equal(List.of(), carry(List.of(snapshot), patches(THIRD_PATCH), history, List.of(removal)));
        equal(List.of(snapshot), carry(List.of(snapshot), patches(FIRST_PATCH), patches(FIRST_PATCH),
                List.of(removal)));
    }

    static void newerSnapshotsAndLaterChangesRestoreVisibility() {
        var old = snapshot(1, OWNER, FIRST_PATCH, 1, "PUBLISHED", "DATA_BASELINE");
        var newer = snapshot(2, OWNER, THIRD_PATCH, 2, "PUBLISHED", "GAME_PATCH");
        var removal = new Change(OWNER, SECOND_PATCH, true);
        var history = patches(FIRST_PATCH, SECOND_PATCH, THIRD_PATCH);
        equal(List.of(newer), carry(List.of(old, newer), patches(THIRD_PATCH), history, List.of(removal)));
        equal(List.of(old, newer), carry(List.of(old, newer), patches(THIRD_PATCH), history,
                List.of(removal, new Change(OWNER, THIRD_PATCH, false))));
        equal(List.of(), carry(List.of(old), patches(THIRD_PATCH), history,
                List.of(removal, new Change(OWNER, SECOND_PATCH, false))));
    }

    static void snapshotOrderingUsesPatchThenRevisionAndKeepsFirstTie() {
        var unplaced = snapshot(1, OWNER, null, 99, "DRAFT", "DATA_BASELINE");
        var older = snapshot(2, OWNER, FIRST_PATCH, 10, "PUBLISHED", "GAME_PATCH");
        var latest = snapshot(3, OWNER, SECOND_PATCH, 3, "PUBLISHED", "GAME_PATCH");
        var correction = snapshot(4, OWNER, SECOND_PATCH, 4, "DRAFT", "CONTENT_CORRECTION");
        var tie = snapshot(5, OWNER, SECOND_PATCH, 4, "PUBLISHED", "TRANSLATION_UPDATE");
        var other = snapshot(6, OTHER_OWNER, null, 1, "PUBLISHED", "DATA_BASELINE");
        equal(Map.of(OWNER, correction.value(), OTHER_OWNER, other.value()),
                CatalogSnapshots.latestByOwner(List.of(unplaced, older, latest, correction, tie, other),
                        CatalogSnapshotScenarios::ordinal));
        equal(Map.of(), CatalogSnapshots.latestByOwner(List.of(), CatalogSnapshotScenarios::ordinal));
    }

    static void latestSelectionCachesOrdinalsWithoutResolvingNull() {
        Map<UUID, Integer> calls = new HashMap<>();
        var candidates = List.of(snapshot(1, OWNER, null, 1, "DRAFT", "DATA_BASELINE"),
                snapshot(2, OWNER, FIRST_PATCH, 2, "DRAFT", "GAME_PATCH"),
                snapshot(3, OWNER, FIRST_PATCH, 3, "DRAFT", "TRANSLATION_UPDATE"),
                snapshot(4, OTHER_OWNER, FIRST_PATCH, 1, "DRAFT", "GAME_PATCH"),
                snapshot(5, OTHER_OWNER, FIRST_PATCH, 2, "DRAFT", "CONTENT_CORRECTION"));
        CatalogSnapshots.latestByOwner(candidates, patch -> {
            if (patch == null)
                throw new AssertionError("Null patch must have ordinal zero without a lookup.");
            calls.merge(patch, 1, Integer::sum);
            return ordinal(patch);
        });
        equal(Map.of(FIRST_PATCH, 1), calls);
    }

    static void randomizedSelectionMatchesPreviousCatalogAlgorithm() {
        var random = new Random(20261021L);
        String[] causes = {"DATA_BASELINE", "GAME_PATCH", "CONTENT_CORRECTION", "TRANSLATION_UPDATE"};
        for (int scenario = 0; scenario < 2000; scenario++) {
            List<Snapshot<String>> candidates = new ArrayList<>();
            Set<UUID> selected = new HashSet<>();
            Set<UUID> applicable = new HashSet<>();
            Set<UUID> targets = new HashSet<>();
            List<Change> changes = new ArrayList<>();
            for (int patch = 1; patch <= 5; patch++) {
                if (random.nextBoolean())
                    selected.add(id(patch));
                if (random.nextBoolean())
                    applicable.add(id(patch));
            }
            for (int index = 0; index < 30; index++) {
                int patch = random.nextInt(6);
                var candidate = snapshot(index + 1, id(100 + random.nextInt(5)), patch == 0 ? null : id(patch),
                        random.nextInt(10), random.nextBoolean() ? "PUBLISHED" : "DRAFT",
                        causes[random.nextInt(causes.length)]);
                candidates.add(candidate);
                if (random.nextBoolean())
                    targets.add(candidate.id());
                changes.add(new Change(id(100 + random.nextInt(5)), id(1 + random.nextInt(5)), random.nextBoolean()));
            }
            var originalCandidates = List.copyOf(candidates);
            equal(legacyChanged(candidates, selected, targets),
                    CatalogSnapshots.changedAt(candidates, selected, targets));
            equal(legacyCarried(candidates, selected, applicable, changes),
                    carry(candidates, selected, applicable, changes));
            equal(legacyLatest(candidates),
                    CatalogSnapshots.latestByOwner(candidates, CatalogSnapshotScenarios::ordinal));
            equal(originalCandidates, candidates);
        }
    }

    private static List<Snapshot<String>> legacyChanged(List<Snapshot<String>> candidates, Set<UUID> allowed,
            Set<UUID> explicitTargets) {
        var recorded = new HashMap<UUID, Set<UUID>>();
        for (var r : candidates)
            if (allowed.contains(r.patchVariantId()) && Set.of("DATA_BASELINE", "GAME_PATCH").contains(r.cause()))
                recorded.computeIfAbsent(r.ownerId(), ignored -> new HashSet<>()).add(r.patchVariantId());
        return candidates.stream().filter(r -> explicitTargets.contains(r.id()) || r.patchVariantId() != null
                && recorded.getOrDefault(r.ownerId(), Set.of()).contains(r.patchVariantId())).toList();
    }

    private static List<Snapshot<String>> legacyCarried(List<Snapshot<String>> candidates, Set<UUID> allowed,
            Set<UUID> applicable, List<Change> changes) {
        candidates = candidates.stream().filter(r -> r.state().equals("PUBLISHED")
                && applicable.contains(r.patchVariantId())).toList();
        var removed = changes.stream().filter(f -> applicable.contains(f.patchVariantId()))
                .collect(Collectors.toMap(Change::ownerId, f -> f,
                        (a, b) -> ordinal(a.patchVariantId()) >= ordinal(b.patchVariantId()) ? a : b));
        return candidates.stream().filter(r -> {
            var fact = removed.get(r.ownerId());
            return fact == null || !fact.removed() || allowed.contains(fact.patchVariantId())
                    || ordinal(r.patchVariantId()) > ordinal(fact.patchVariantId());
        }).toList();
    }

    private static Map<UUID, String> legacyLatest(List<Snapshot<String>> candidates) {
        Map<UUID, Long> ordinals = new HashMap<>();
        return candidates.stream().collect(Collectors.toMap(Snapshot::ownerId, Function.identity(), (a, b) -> {
            long first = a.patchVariantId() == null ? 0 : ordinals.computeIfAbsent(a.patchVariantId(),
                    CatalogSnapshotScenarios::ordinal);
            long second = b.patchVariantId() == null ? 0 : ordinals.computeIfAbsent(b.patchVariantId(),
                    CatalogSnapshotScenarios::ordinal);
            int difference = Long.compare(first, second);
            int comparison = difference != 0 ? difference : Long.compare(a.revisionNo(), b.revisionNo());
            return comparison >= 0 ? a : b;
        })).entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, entry -> entry.getValue().value()));
    }

    private static List<Snapshot<String>> carry(List<Snapshot<String>> candidates, Set<UUID> selected,
            Set<UUID> applicable, List<Change> changes) {
        return CatalogSnapshots.carriedForward(candidates, selected, applicable, changes,
                CatalogSnapshotScenarios::ordinal);
    }

    private static Snapshot<String> snapshot(long identifier, UUID owner, UUID patch, long revision,
            String state, String cause) {
        return new Snapshot<>(id(1000 + identifier), owner, patch, revision, state, cause, "revision-" + identifier);
    }

    private static Set<UUID> patches(UUID... ids) {
        return new HashSet<>(List.of(ids));
    }

    private static long ordinal(UUID patch) {
        return patch == null ? 0 : patch.getLeastSignificantBits();
    }

    private static UUID id(long value) {
        return new UUID(0, value);
    }

    private static void equal(Object expected, Object actual) {
        if (!expected.equals(actual))
            throw new AssertionError("Expected " + expected + " but got " + actual);
    }
}
