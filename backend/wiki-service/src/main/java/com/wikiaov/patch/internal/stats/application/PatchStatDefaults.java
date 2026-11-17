package com.wikiaov.patch.internal.stats.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.patch.PatchDataReviews;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.authoring.persistence.PatchVariantRepository;
import com.wikiaov.patch.internal.stats.persistence.PatchStatDefaultRepository;
import com.wikiaov.patch.internal.stats.persistence.entity.PatchStatDefault;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogAggregates;
import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class PatchStatDefaults {
    private final PatchStatDefaultRepository defaults;
    private final PatchVariantRepository variants;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final PatchDataReviews reviews;

    public record StatDefaultView(
            String statKey,
            BigDecimal baseValue,
            String unit,
            String sourceUrl,
            UUID variantId,
            String patchCode,
            long version
    ) {
    }

    public record SetStatDefault(
            BigDecimal baseValue,
            String unit,
            String sourceUrl,
            Long expectedVersion
    ) {
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<StatDefaultView> effective(UUID id) {
        if (!variants.existsById(id))
            throw new ApiException(PatchErrorCode.PATCH_NOT_FOUND, "The patch variant was not found.");
        return defaults.effective(id).stream().map(d -> new StatDefaultView(d.getStatKey(), d.getBaseValue(),
                d.getUnit(), d.getSourceUrl(), d.getVariantId(), d.getPatchCode(), d.getVersion())).toList();
    }

    @PreAuthorize("hasAuthority('patch:write')")
    public void set(UUID id, String key, SetStatDefault input) {
        if (!key.matches("[A-Z][A-Z0-9_]{0,63}") || input.baseValue() == null || input.baseValue().precision() > 18
                || Math.abs((long) input.baseValue().scale()) > 12 || input.unit() == null
                || !Set.of("POINT", "PERCENT").contains(input.unit()) || input.expectedVersion() == null
                || input.expectedVersion() < 0 || !validSource(input.sourceUrl()))
            throw new ApiException(PatchErrorCode.PATCH_INVALID,
                    "Provide a numeric default, unit and HTTP source URL.");

        variants.lockById(id).orElseThrow(
                () -> new ApiException(PatchErrorCode.PATCH_NOT_FOUND, "The patch variant was not found."));
        var row = defaults.findByVariantIdAndStatKey(id, key).orElseGet(PatchStatDefault::new);
        if (row.getVersion() != input.expectedVersion())
            throw new ApiException(PatchErrorCode.PATCH_CONFLICT, "The default has changed. Reload before saving.");
        if (row.getId() == null) {
            row.setId(UUID.randomUUID());
            row.setVariantId(id);
            row.setStatKey(key);
        }
        row.setBaseValue(input.baseValue());
        row.setUnit(input.unit());
        row.setSourceUrl(input.sourceUrl());
        row.setVersion(row.getVersion() + 1);
        defaults.saveAndFlush(row);
        reviews.markDirty(id);
        audit.record(new AuditEntry(actors.require(), "PATCH_STAT_DEFAULT_SET", CatalogAggregates.PATCH, id, null,
                input.expectedVersion(), row.getVersion(), null,
                Map.of("statKey", key, "baseValue", input.baseValue())));
    }

    private static boolean validSource(String text) {
        if (text == null || text.length() > 2048)
            return false;
        try {
            var uri = URI.create(text);
            return ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }
}
