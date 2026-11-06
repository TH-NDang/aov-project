package com.wikiaov.community.tournament.internal.media.application;

import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.tournament.internal.application.TournamentErrorCode;
import com.wikiaov.community.tournament.internal.archive.persistence.RegistryWriteGuard;
import com.wikiaov.community.tournament.internal.media.persistence.RetiredMediaAsset;
import com.wikiaov.community.tournament.internal.media.persistence.RetiredMediaRepository;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CompetitionMedia {
    private static final Pattern ASSET_PATH = Pattern.compile(
            "/(?:assets|media)/([0-9a-fA-F-]{36})/[0-9a-fA-F-]{36}\\.(?:png|jpg|webp)");
    private final RetiredMediaRepository repository;
    private final RegistryWriteGuard writes;
    private final java.util.List<com.wikiaov.community.tournament.CompetitionReferences> additional;

    public CompetitionMedia(RetiredMediaRepository repository, RegistryWriteGuard writes,
            java.util.List<com.wikiaov.community.tournament.CompetitionReferences> additional) {
        this.repository = repository;
        this.writes = writes;
        this.additional = additional;
    }

    public record Usage(
            UUID assetId,
            long references,
            boolean retired
    ) {
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public Usage usage(UUID assetId) {
        return new Usage(assetId, references(assetId), repository.existsById(assetId));
    }

    public record References(
            Map<UUID, Long> references
    ) {
    }

    /** Which images live records name and how many records name each, so Wiki can label a whole image list. */
    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public References references() {
        Map<UUID, Long> counts = new HashMap<>();
        repository.allReferences().forEach(asset -> count(counts, asset));
        additional.forEach(provider -> provider.allMediaReferences().forEach(asset -> count(counts, asset)));

        return new References(counts);
    }

    private static void count(Map<UUID, Long> counts, String asset) {
        try {
            counts.merge(UUID.fromString(asset), 1L, Long::sum);
        } catch (IllegalArgumentException exception) {
            // The pattern only looks like an id; anything else in that position is not a managed image.
        }
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public Usage retire(UUID assetId) {
        writes.acquire();
        long references = references(assetId);
        if (references > 0) {
            throw new ApiException(TournamentErrorCode.TOURNAMENT_RECORD_IN_USE,
                    "The image is referenced by competition records or publication history.",
                    Map.of("references", references));
        }
        if (!repository.existsById(assetId)) {
            repository.save(new RetiredMediaAsset(assetId));
        }
        return new Usage(assetId, 0, true);
    }

    /** Called under the same registry write lock used when retiring an image. */
    public void requireAvailable(String url) {
        if (url == null || url.isBlank())
            return;
        var uri = URI.create(url);
        var matcher = ASSET_PATH.matcher(uri.getPath());
        if (!matcher.matches())
            return;
        if (!uri.getRawPath().equals(uri.getPath())) {
            throw new ApiException(TournamentErrorCode.TOURNAMENT_INVALID_CONTENT,
                    "Managed image URLs must use their canonical, unescaped object path.");
        }
        UUID assetId;
        try {
            assetId = UUID.fromString(matcher.group(1));
        } catch (IllegalArgumentException exception) {
            return;
        }
        if (repository.existsById(assetId)) {
            throw new ApiException(TournamentErrorCode.TOURNAMENT_MEDIA_RETIRED,
                    "The image has been retired and cannot be referenced again.");
        }
    }

    private long references(UUID id) {
        return repository.countReferences(id)
                + additional.stream().mapToLong(provider -> provider.mediaReferences(id)).sum();
    }
}
