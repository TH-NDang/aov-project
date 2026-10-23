package com.wikiaov.patch.internal.context.application;

import com.wikiaov.patch.*;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.authoring.persistence.GamePatchRepository;
import com.wikiaov.patch.internal.authoring.persistence.GamePatchTranslationRepository;
import com.wikiaov.patch.internal.context.persistence.GameplayContextRepository;
import com.wikiaov.patch.internal.ruleset.application.Regions;
import com.wikiaov.platform.*;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PatchQueries implements PatchCatalog {
    private final GamePatchRepository patches;
    private final GamePatchTranslationRepository translations;
    private final GameplayContextRepository contexts;
    private final Regions regions;

    public PatchQueries(GamePatchRepository patches, GamePatchTranslationRepository translations,
            GameplayContextRepository contexts, Regions regions) {
        this.patches = patches;
        this.translations = translations;
        this.contexts = contexts;
        this.regions = regions;
    }

    public Map<String, Object> published(UUID id, String region, String locale) {
        validateLocale(locale);
        var release = releases(region).stream().filter(r -> r.patchId().equals(id)).findFirst()
                .orElseThrow(() -> new ApiException(PatchErrorCode.PATCH_NOT_FOUND,
                        "No published patch is scheduled for this region."));
        var patch = patches.findByIdAndStatus(id, "PUBLISHED").orElseThrow(
                () -> new ApiException(PatchErrorCode.PATCH_NOT_FOUND, "Patch resource does not exist."));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", patch.getId());
        result.put("code", patch.getCode());
        result.put("sequence", patch.getSequence());
        translations.preferred(id, locale, PageRequest.of(0, 1)).stream().findFirst().ifPresent(text -> {
            result.put("locale", text.getLocale());
            result.put("title", text.getTitle());
            result.put("summary", text.getSummary());
            result.put("description", text.getDescription());
            result.put("actualLocale", text.getLocale());
            result.put("fallbackApplied", !locale.equals(text.getLocale()));
        });
        result.put("region", region);
        result.put("requestedLocale", locale);
        result.put("variantId", release.variantId());
        result.put("effectiveAt", release.effectiveAt());
        return result;
    }

    public PageSlice<Map<String, Object>> list(String region, String locale, int page, int size) {
        validateLocale(locale);
        if (page < 0 || size < 1 || size > 100)
            throw new ApiException(PatchErrorCode.PATCH_INVALID, "Invalid page bounds.");
        var ids = releases(region).stream().map(PatchReleaseReference::patchId).distinct().toList();
        long offset = (long) page * size;
        return new PageSlice<>(ids.stream().skip(offset).limit(size).map(id -> published(id, region, locale)).toList(),
                page, size, ids.size());
    }

    public List<PatchReleaseReference> releases(String region) {
        regions.select(region);
        return contexts.publishedReleases(region);
    }

    private static void validateLocale(String value) {
        try {
            if (!new Locale.Builder().setLanguageTag(value).build().toLanguageTag().equals(value))
                throw new IllegalArgumentException();
        } catch (IllegalArgumentException exception) {
            throw new ApiException(PatchErrorCode.PATCH_INVALID, "Use a canonical BCP 47 locale.");
        }
    }
}
