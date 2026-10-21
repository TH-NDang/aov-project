package com.wikiaov.platform;

import org.junit.jupiter.api.Test;

class CatalogSnapshotsTests {
    @Test
    void gameplayChangesIncludeCorrectionsButNotUnrelatedOwners() {
        CatalogSnapshotScenarios.gameplayChangesIncludeCorrectionsButNotUnrelatedOwners();
    }

    @Test
    void explicitTargetsIncludeLegacyUnplacedSnapshots() {
        CatalogSnapshotScenarios.explicitTargetsIncludeLegacyUnplacedSnapshots();
    }

    @Test
    void carriedForwardExcludesDraftsAndFuturePatches() {
        CatalogSnapshotScenarios.carriedForwardExcludesDraftsAndFuturePatches();
    }

    @Test
    void removalsAreVisibleAtTheirPatchButNotLater() {
        CatalogSnapshotScenarios.removalsAreVisibleAtTheirPatchButNotLater();
    }

    @Test
    void newerSnapshotsAndLaterChangesRestoreVisibility() {
        CatalogSnapshotScenarios.newerSnapshotsAndLaterChangesRestoreVisibility();
    }

    @Test
    void snapshotOrderingUsesPatchThenRevisionAndKeepsFirstTie() {
        CatalogSnapshotScenarios.snapshotOrderingUsesPatchThenRevisionAndKeepsFirstTie();
    }

    @Test
    void latestSelectionCachesOrdinalsWithoutResolvingNull() {
        CatalogSnapshotScenarios.latestSelectionCachesOrdinalsWithoutResolvingNull();
    }

    @Test
    void randomizedSelectionMatchesPreviousCatalogAlgorithm() {
        CatalogSnapshotScenarios.randomizedSelectionMatchesPreviousCatalogAlgorithm();
    }

}
