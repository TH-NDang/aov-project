package com.wikiaov.patch.internal.context.application;

import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchCatalog;
import com.wikiaov.patch.PatchMarketRelease;
import com.wikiaov.patch.PatchReleaseReference;
import com.wikiaov.patch.PatchSources;
import com.wikiaov.patch.PublishedPatch;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.authoring.persistence.GamePatchRepository;
import com.wikiaov.patch.internal.authoring.persistence.GamePatchTranslationRepository;
import com.wikiaov.patch.internal.authoring.persistence.entity.GamePatchTranslation;
import com.wikiaov.patch.internal.context.persistence.GameplayContextRepository;
import com.wikiaov.patch.internal.domain.PatchStatus;
import com.wikiaov.patch.internal.ruleset.application.Regions;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.PageSlice;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PatchQueries implements PatchCatalog {
    private final GamePatchRepository patches;
    private final GamePatchTranslationRepository translations;
    private final GameplayContextRepository contexts;
    private final Regions regions;
    private final GameplayContexts gameplay;
    private final PatchSources sources;
    private final Clock clock;

    public PatchQueries(GamePatchRepository patches, GamePatchTranslationRepository translations,
            GameplayContextRepository contexts, Regions regions, GameplayContexts gameplay, PatchSources sources,
            Clock clock) {
        this.patches = patches;
        this.translations = translations;
        this.contexts = contexts;
        this.regions = regions;
        this.gameplay = gameplay;
        this.sources = sources;
        this.clock = clock;
    }

    @Override
    public PublishedPatch published(UUID id, String region, String locale) {
        validateLocale(locale);
        var release = releases(region).stream().filter(r -> r.patchId().equals(id)).findFirst()
                .orElseThrow(() -> new ApiException(PatchErrorCode.PATCH_NOT_FOUND,
                        "No published patch is scheduled for this region."));
        return view(id, region, locale, release.variantId(), release.rulesetId(), release.effectiveAt());
    }

    @Override
    public PublishedPatch publishedVariant(UUID id, UUID variantId, String region, String locale) {
        validateLocale(locale);
        var context = gameplay.resolveCatalog(region, clock.instant(), null, variantId);
        if (!context.patchId().equals(id)) {
            throw new ApiException(PatchErrorCode.PATCH_NOT_FOUND,
                    "The requested variant does not belong to this patch.");
        }

        return view(id, region, locale, context.patchVariantId(), context.rulesetId(), context.effectiveAt());
    }

    private PublishedPatch view(UUID id, String region, String locale, UUID variantId, UUID rulesetId,
            Instant effectiveAt) {
        var patch = patches.findByIdAndStatus(id, PatchStatus.PUBLISHED).orElseThrow(
                () -> new ApiException(PatchErrorCode.PATCH_NOT_FOUND, "Patch resource does not exist."));
        var text = CatalogLocales.pick(translations.findByPatchId(id), locale, GamePatchTranslation::getLocale);

        return new PublishedPatch(patch.getId(), patch.getCode(), patch.getSequence(),
                text == null
                        ? null
                        : new PublishedPatch.Text(text.getLocale(), text.getTitle(), text.getSummary(),
                                text.getDescription(), text.getLocale(), !locale.equals(text.getLocale())),
                region, locale, variantId, rulesetId, effectiveAt, sources.of(variantId), markets(variantId));
    }

    /** A confirmed day keeps only its day: the moment its confirmation recorded is not when the game updated. */
    private List<PatchMarketRelease> markets(UUID variantId) {
        return contexts.marketReleases(variantId).stream()
                .map(release -> release.effectiveOn() == null
                        ? release
                        : new PatchMarketRelease(release.region(), release.timeZone(), null, release.effectiveOn()))
                .toList();
    }

    @Override
    public PageSlice<PublishedPatch> list(String region, String locale, int page, int size) {
        validateLocale(locale);
        var ids = releases(region).stream().map(PatchReleaseReference::patchId).distinct().toList();
        // Paged in memory: the patches come from the market's release schedule, and a market has a few dozen.
        long offset = (long) page * size;
        return new PageSlice<>(ids.stream().skip(offset).limit(size).map(id -> published(id, region, locale)).toList(),
                page, size, ids.size());
    }

    @Override
    public List<PatchReleaseReference> releases(String region) {
        regions.select(region);
        return contexts.publishedReleases(region);
    }

    private static void validateLocale(String value) {
        try {
            if (!new Locale.Builder().setLanguageTag(value).build().toLanguageTag().equals(value)) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException exception) {
            throw new ApiException(PatchErrorCode.PATCH_INVALID, "Use a canonical BCP 47 locale.");
        }
    }
}
