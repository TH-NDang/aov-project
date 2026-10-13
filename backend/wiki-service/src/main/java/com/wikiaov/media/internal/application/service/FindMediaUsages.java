package com.wikiaov.media.internal.application.service;

import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageProvider;
import com.wikiaov.media.MediaUsageScope;
import com.wikiaov.media.internal.application.response.MediaUsageReport;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Where is this asset used? (03 section 35). Asks every {@link MediaUsageProvider}; the owner modules stay the
 * source of truth. Until hero media bindings exist (Phase 3) there are no providers and the answer is empty.
 */
@Service
public class FindMediaUsages {

    private final ObjectProvider<MediaUsageProvider> providers;
    private final MediaSupport support;

    FindMediaUsages(ObjectProvider<MediaUsageProvider> providers, MediaSupport support) {
        this.providers = providers;
        this.support = support;
    }

    /** @param scope filter for {@code items}; {@code null} returns every usage */
    @Transactional(readOnly = true)
    public MediaUsageReport execute(UUID assetId, @Nullable MediaUsageScope scope) {
        support.requireAsset(assetId);
        List<MediaUsage> usages = collect(assetId);
        MediaUsageReport.Counts counts = new MediaUsageReport.Counts(count(usages, MediaUsageScope.CURRENT),
                count(usages, MediaUsageScope.DRAFT), count(usages, MediaUsageScope.HISTORICAL));
        List<MediaUsage> items = scope == null
                ? usages
                : usages.stream().filter(usage -> usage.scope() == scope).toList();
        return new MediaUsageReport(assetId, counts, items);
    }

    List<MediaUsage> collect(UUID assetId) {
        return providers.orderedStream().flatMap(provider -> provider.findUsages(assetId).stream()).toList();
    }

    private static long count(List<MediaUsage> usages, MediaUsageScope scope) {
        return usages.stream().filter(usage -> usage.scope() == scope).count();
    }
}
