package com.wikiaov.community.tournament.internal.media.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "retired_media_asset", schema = "tournament")
public class RetiredMediaAsset {
    @Id
    private UUID id;
    private Instant retiredAt;

    protected RetiredMediaAsset() {
    }

    public RetiredMediaAsset(UUID id) {
        this.id = id;
        this.retiredAt = Instant.now();
    }
}
