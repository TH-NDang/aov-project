package com.wikiaov.patch.internal.application.service;

import com.wikiaov.patch.*;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.persistence.PatchStore;
import com.wikiaov.platform.*;
import java.sql.Timestamp;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PatchQueries implements PatchCatalog {
    private final PatchStore store;
    private final Regions regions;
    public PatchQueries(PatchStore store, Regions regions) {
        this.store = store;
        this.regions = regions;
    }

    public Map<String, Object> published(UUID id, String region, String locale) {
        validateLocale(locale);
        var release = releases(region).stream().filter(r -> r.patchId().equals(id)).findFirst()
                .orElseThrow(() -> new ApiException(PatchErrorCode.PATCH_NOT_FOUND,
                        "No published patch is scheduled for this region."));
        var patch = store.one("SELECT id,code,sequence FROM patch.game_patch WHERE id=? AND status='PUBLISHED'", id);
        Map<String, Object> result = new LinkedHashMap<>(patch);
        var t = store.rows(
                "SELECT locale,title,summary,description FROM patch.game_patch_translation WHERE patch_id=? ORDER BY (locale=?) DESC,(locale='vi-VN') DESC,locale LIMIT 1",
                id, locale);
        if (!t.isEmpty()) {
            result.putAll(t.getFirst());
            result.put("actualLocale", t.getFirst().get("locale"));
            result.put("fallbackApplied", !locale.equals(t.getFirst().get("locale")));
        }
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
        return store.rows("""
   SELECT p.id patch_id,v.id variant_id,v.ruleset_id,rel.effective_at
   FROM patch.patch_release rel JOIN patch.region r ON r.id=rel.region_id
   JOIN patch.patch_variant v ON v.id=rel.patch_variant_id AND v.status='PUBLISHED'
   JOIN patch.game_patch p ON p.id=v.patch_id AND p.status='PUBLISHED'
   WHERE r.code=? AND rel.status='SCHEDULED' ORDER BY p.sequence DESC,rel.effective_at DESC
   """, region).stream().map(row -> new PatchReleaseReference((UUID) row.get("patch_id"), (UUID) row.get("variant_id"),
                (UUID) row.get("ruleset_id"), ((Timestamp) row.get("effective_at")).toInstant())).toList();
    }

    private static void validateLocale(String value) {
        try {
            if (!new Locale.Builder().setLanguageTag(value).build().toLanguageTag().equals(value))
                throw new IllegalArgumentException();
        } catch (IllegalArgumentException e) {
            throw new ApiException(PatchErrorCode.PATCH_INVALID, "Use a canonical BCP 47 locale.");
        }
    }
}
