package com.wikiaov.platform;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CatalogCauseTest {
    @Test
    void aForkNamesAnyCauseButABaseline() {
        assertThat(CatalogCause.ofFork("GAME_PATCH")).isEqualTo(CatalogCause.GAME_PATCH);
        assertThat(CatalogCause.ofFork("CONTENT_CORRECTION")).isEqualTo(CatalogCause.CONTENT_CORRECTION);
        assertThat(CatalogCause.ofFork("TRANSLATION_UPDATE")).isEqualTo(CatalogCause.TRANSLATION_UPDATE);
        assertThat(CatalogCause.ofFork("DATA_BASELINE")).isNull();
        assertThat(CatalogCause.ofFork("TRANSLATION")).isNull();
    }

    @Test
    void onlyABaselineAndAGamePatchRecordGameplay() {
        assertThat(CatalogCause.values()).filteredOn(CatalogCause::gameplay)
                .containsExactly(CatalogCause.DATA_BASELINE, CatalogCause.GAME_PATCH);
    }
}
