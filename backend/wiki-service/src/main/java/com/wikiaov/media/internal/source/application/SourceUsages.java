package com.wikiaov.media.internal.source.application;

import com.wikiaov.media.SourceFileUsage;
import com.wikiaov.media.SourceFileUsageProvider;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/** Asks every {@link SourceFileUsageProvider}; the owner modules stay the source of truth for their evidence. */
@Component
class SourceUsages {

    private final ObjectProvider<SourceFileUsageProvider> providers;

    SourceUsages(ObjectProvider<SourceFileUsageProvider> providers) {
        this.providers = providers;
    }

    List<SourceFileUsage> find(String sha256) {
        return providers.orderedStream().flatMap(provider -> provider.findUsages(sha256).stream()).toList();
    }

    Set<String> referenced(Collection<String> sha256s) {
        Set<String> referenced = new HashSet<>();
        if (sha256s.isEmpty()) {
            return referenced;
        }
        providers.orderedStream().forEach(provider -> referenced.addAll(provider.findReferenced(sha256s)));
        return referenced;
    }
}
