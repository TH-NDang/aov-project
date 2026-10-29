package com.wikiaov.media.internal.query.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.wikiaov.media.MediaAssetState;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.media.internal.asset.persistence.MediaAssetRepository;
import com.wikiaov.media.internal.asset.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.asset.persistence.entity.MediaAsset;
import com.wikiaov.media.internal.asset.persistence.entity.MediaAssetVersion;
import com.wikiaov.media.internal.domain.model.ActorRef;
import com.wikiaov.media.internal.ingestion.domain.image.ImageFormat;
import com.wikiaov.media.internal.ingestion.domain.image.ImageInspection;
import com.wikiaov.media.internal.provenance.persistence.MediaProvenanceRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MediaAssetLookupTest {

    private static final Instant NOW = Instant.parse("2026-10-20T00:00:00Z");
    private static final ActorRef ACTOR = new ActorRef("https://identity.example", "editor");

    private final MediaAssetRepository assets = mock(MediaAssetRepository.class);
    private final MediaAssetVersionRepository versions = mock(MediaAssetVersionRepository.class);
    private final MediaUrls urls = mock(MediaUrls.class);
    private final MediaProvenanceRepository provenance = mock(MediaProvenanceRepository.class);
    private final MediaAssetLookup lookup = new MediaAssetLookup(assets, versions, urls, provenance);

    @Test
    void batchesDistinctAssetsAndTheirCurrentVersionsWithoutIndividualQueries() {
        var active = asset();
        var activeVersion = version(active);
        active.activate(activeVersion, NOW);
        var deprecated = asset();
        var deprecatedVersion = version(deprecated);
        deprecated.activate(deprecatedVersion, NOW);
        deprecated.deprecate(NOW);
        var pending = asset();
        UUID missing = UUID.randomUUID();
        var requested = Set.of(active.getId(), deprecated.getId(), pending.getId(), missing);
        when(assets.findByIdIn(requested)).thenReturn(List.of(active, deprecated, pending));
        when(versions.findByIdIn(Set.of(activeVersion.getId(), deprecatedVersion.getId())))
                .thenReturn(List.of(activeVersion, deprecatedVersion));
        when(urls.publicUrl(activeVersion)).thenReturn("/media/active.webp");
        when(urls.publicUrl(deprecatedVersion)).thenReturn("/media/deprecated.webp");

        var found = lookup
                .findAll(List.of(active.getId(), active.getId(), deprecated.getId(), pending.getId(), missing));

        assertThat(found).containsOnlyKeys(active.getId(), deprecated.getId(), pending.getId());
        assertThat(found.get(active.getId()).usable()).isTrue();
        assertThat(found.get(active.getId()).currentVersion().url()).isEqualTo("/media/active.webp");
        assertThat(found.get(active.getId()).currentVersion().versionId()).isEqualTo(activeVersion.getId());
        assertThat(found.get(deprecated.getId()).state()).isEqualTo(MediaAssetState.DEPRECATED);
        assertThat(found.get(deprecated.getId()).usable()).isFalse();
        assertThat(found.get(deprecated.getId()).currentVersion().url()).isEqualTo("/media/deprecated.webp");
        assertThat(found.get(pending.getId()).currentVersion()).isNull();
        assertThat(found.get(pending.getId()).usable()).isFalse();
        verify(assets).findByIdIn(requested);
        verify(versions).findByIdIn(Set.of(activeVersion.getId(), deprecatedVersion.getId()));
        verify(assets, never()).findById(any());
        verify(versions, never()).findById(any());
        verifyNoMoreInteractions(assets, versions);
    }

    @Test
    void avoidsDatabaseQueriesForAnEmptyBatch() {
        assertThat(lookup.findAll(List.of())).isEmpty();
        verifyNoInteractions(assets, versions, urls);
    }

    @Test
    void avoidsVersionQueriesWhenNoCurrentVersionExists() {
        var pending = asset();
        when(assets.findByIdIn(Set.of(pending.getId()))).thenReturn(List.of(pending));

        assertThat(lookup.findAll(List.of(pending.getId())).get(pending.getId()).currentVersion()).isNull();
        verifyNoInteractions(versions, urls);
    }

    @Test
    void treatsAMissingCurrentVersionLikeTheSingleAssetLookup() {
        var asset = asset();
        var version = version(asset);
        asset.activate(version, NOW);
        when(assets.findById(asset.getId())).thenReturn(Optional.of(asset));
        when(assets.findByIdIn(Set.of(asset.getId()))).thenReturn(List.of(asset));
        when(versions.findById(version.getId())).thenReturn(Optional.empty());
        when(versions.findByIdIn(Set.of(version.getId()))).thenReturn(List.of());

        assertThat(lookup.findAll(List.of(asset.getId())).get(asset.getId()))
                .isEqualTo(lookup.find(asset.getId()).orElseThrow());
        verifyNoInteractions(urls);
    }

    private static MediaAsset asset() {
        return MediaAsset.create(UUID.randomUUID(), MediaSemanticType.ITEM_ICON, ACTOR, NOW);
    }

    private static MediaAssetVersion version(MediaAsset asset) {
        return MediaAssetVersion.ready(UUID.randomUUID(), asset.getId(), 1, "primary", "assets/icon.webp",
                new ImageInspection(ImageFormat.WEBP, 120, 120, 1024, "a".repeat(64)), ACTOR, NOW);
    }
}
