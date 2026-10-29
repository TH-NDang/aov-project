package com.wikiaov.media.internal.provenance.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.media.internal.application.SourceInput;
import com.wikiaov.media.internal.domain.model.ProvenanceSourceType;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MediaCreditsTest {
    @Test
    void selectsTheDisplayedVersionWithoutPublishingPrivateNotes() {
        UUID asset = UUID.randomUUID();
        UUID version = UUID.randomUUID();
        var common = new SourceInput(ProvenanceSourceType.OTHER, "Legacy", null, null, "private/path.png")
                .toProvenance(asset, null, Instant.EPOCH);
        var current = new SourceInput(ProvenanceSourceType.OFFICIAL, "Garena", "https://example.com/art", null,
                "private/path.png", "Garena", "https://example.com/contact")
                .toProvenance(asset, version, Instant.EPOCH);
        var old = new SourceInput(ProvenanceSourceType.OTHER, "Old source", null, null, null)
                .toProvenance(asset, UUID.randomUUID(), Instant.EPOCH);

        var credits = MediaCredits.forVersion(List.of(common, current, old), version);

        assertThat(credits).hasSize(1);
        assertThat(credits.getFirst().label()).isEqualTo("Garena");
        assertThat(credits.getFirst().ownerName()).isEqualTo("Garena");
        assertThat(credits.getFirst().contactUrl()).isEqualTo("https://example.com/contact");
        assertThat(credits.toString()).doesNotContain("private/path.png");
        assertThat(MediaCredits.forVersion(List.of(common, old), version).getFirst().label()).isEqualTo("Legacy");
    }
}
