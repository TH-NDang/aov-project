package com.wikiaov.platform;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.platform.CatalogChanges.Kind;
import com.wikiaov.platform.CatalogChanges.Record;
import com.wikiaov.platform.CatalogChanges.Summary;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CatalogChangesTest {
    private static final UUID PATCH = UUID.randomUUID();
    private static final UUID TARGET = UUID.randomUUID();
    private static final List<Summary> SUMMARY = List.of(new Summary("vi-VN", "Tăng sát thương."));
    private static final String SOURCE = "https://example.org/patch-notes";

    @Test
    void aRecordNamesAPatchATargetAndUpToFourDistinctKinds() {
        assertThat(CatalogChanges.requestProblem(new Record(null, TARGET, null, List.of(Kind.BUFF), SUMMARY, SOURCE)))
                .isNotNull();
        assertThat(CatalogChanges.requestProblem(record(UUID.randomUUID(), List.of(Kind.BUFF, Kind.BUFF))))
                .isEqualTo("A patch, published target and unique change kinds are required.");
        assertThat(CatalogChanges.requestProblem(record(UUID.randomUUID(),
                List.of(Kind.BUFF, Kind.NERF, Kind.FIX, Kind.REWORK, Kind.BALANCE)))).isNotNull();
        assertThat(CatalogChanges.requestProblem(record(UUID.randomUUID(), List.of(Kind.BUFF, Kind.FIX)))).isNull();
    }

    @Test
    void aBaselineOrAnAdditionStandsAlone() {
        assertThat(CatalogChanges.kindsProblem(record(null, List.of(Kind.ADDED, Kind.BUFF)),
                CatalogCause.GAME_PATCH, false))
                .isEqualTo("Baseline and addition must be recorded separately from balance changes.");
    }

    @Test
    void onlyABaselineSnapshotIsClassifiedAsABaseline() {
        assertThat(CatalogChanges.kindsProblem(record(null, List.of(Kind.DATA_BASELINE)), CatalogCause.GAME_PATCH,
                false)).isEqualTo("Only baseline snapshots can be classified as baseline.");
        assertThat(CatalogChanges.kindsProblem(record(null, List.of(Kind.DATA_BASELINE)),
                CatalogCause.DATA_BASELINE, false)).isNull();
    }

    @Test
    void anUpdateNeedsAGameplaySnapshotAndThePreviousOne() {
        assertThat(CatalogChanges.kindsProblem(record(null, List.of(Kind.BUFF)), CatalogCause.GAME_PATCH, false))
                .isEqualTo("Updates require a gameplay snapshot and a known previous snapshot.");
        assertThat(CatalogChanges.kindsProblem(record(UUID.randomUUID(), List.of(Kind.BUFF)),
                CatalogCause.GAME_PATCH, false)).isNull();
        assertThat(CatalogChanges.kindsProblem(record(null, List.of(Kind.REMOVED)), CatalogCause.GAME_PATCH, true))
                .isNull();
    }

    @Test
    void evidenceIsOneShortSummaryPerLocaleAndAnHttpSource() {
        assertThat(CatalogChanges.evidenceProblem(evidence(List.of(), SOURCE)))
                .isEqualTo("A localized change summary is required.");
        assertThat(CatalogChanges.evidenceProblem(evidence(List.of(SUMMARY.getFirst(), SUMMARY.getFirst()), SOURCE)))
                .isEqualTo("Invalid or duplicate summary translations.");
        assertThat(CatalogChanges.evidenceProblem(evidence(SUMMARY, "ftp://example.org/notes")))
                .isEqualTo("An HTTP source URL is required for confirmed game changes.");
        assertThat(CatalogChanges.evidenceProblem(evidence(SUMMARY, SOURCE))).isNull();
    }

    private static Record record(UUID fromRevisionId, List<Kind> kinds) {
        return new Record(PATCH, TARGET, fromRevisionId, kinds, SUMMARY, SOURCE);
    }

    private static Record evidence(List<Summary> translations, String sourceUrl) {
        return new Record(PATCH, TARGET, null, List.of(Kind.BUFF), translations, sourceUrl);
    }
}
