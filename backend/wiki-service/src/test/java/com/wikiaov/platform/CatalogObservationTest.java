package com.wikiaov.platform;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class CatalogObservationTest {
    @Test
    void permitsOnlyBaselineAndSourceBackedEditsWithoutPatch() {
        assertThat(CatalogObservation.isUnscopedBaseline(CatalogCause.DATA_BASELINE, null, null)).isTrue();
        for (var cause : new CatalogCause[] {CatalogCause.CONTENT_CORRECTION, CatalogCause.TRANSLATION_UPDATE}) {
            assertThat(CatalogObservation.isUnscopedBaseline(cause, UUID.randomUUID(), null)).isTrue();
            assertThat(CatalogObservation.isUnscopedBaseline(cause, null, null)).isFalse();
        }
        assertThat(CatalogObservation.isUnscopedBaseline(CatalogCause.GAME_PATCH, UUID.randomUUID(), null)).isFalse();
        assertThat(CatalogObservation.isUnscopedBaseline(null, null, null)).isFalse();
        assertThat(CatalogObservation.isUnscopedBaseline(CatalogCause.DATA_BASELINE, null, UUID.randomUUID()))
                .isFalse();
    }
}
