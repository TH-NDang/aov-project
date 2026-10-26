package com.wikiaov.platform;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class CatalogObservationTest {
    @Test
    void permitsOnlyBaselineAndSourceBackedEditsWithoutPatch() {
        assertThat(CatalogObservation.isUnscopedBaseline("DATA_BASELINE", null, null)).isTrue();
        for (var cause : new String[] {"CONTENT_CORRECTION", "TRANSLATION_UPDATE"}) {
            assertThat(CatalogObservation.isUnscopedBaseline(cause, UUID.randomUUID(), null)).isTrue();
            assertThat(CatalogObservation.isUnscopedBaseline(cause, null, null)).isFalse();
        }
        assertThat(CatalogObservation.isUnscopedBaseline("GAME_PATCH", UUID.randomUUID(), null)).isFalse();
        assertThat(CatalogObservation.isUnscopedBaseline("OTHER", null, null)).isFalse();
        assertThat(CatalogObservation.isUnscopedBaseline("DATA_BASELINE", null, UUID.randomUUID())).isFalse();
    }
}
