package com.wikiaov.build.internal.application;

import com.wikiaov.build.BuildReference;
import com.wikiaov.build.BuildReferenceKind;
import com.wikiaov.build.BuildReferenceProvider;
import java.util.*;
import org.springframework.stereotype.Component;

/** Asks the owning module of each kind about the records a build refers to. */
@Component
public class BuildReferences {
    private final Map<BuildReferenceKind, BuildReferenceProvider> providers = new EnumMap<>(BuildReferenceKind.class);

    public BuildReferences(List<BuildReferenceProvider> providers) {
        for (var provider : providers)
            if (this.providers.put(provider.kind(), provider) != null)
                throw new IllegalStateException("Two modules answer build references of kind " + provider.kind());
    }

    public Map<String, BuildReference> byCodes(BuildReferenceKind kind, Collection<String> codes) {
        return codes.isEmpty() ? Map.of() : provider(kind).byCodes(Set.copyOf(codes));
    }

    public Map<UUID, BuildReference> byIds(BuildReferenceKind kind, Collection<UUID> ids) {
        return ids.isEmpty() ? Map.of() : provider(kind).byIds(Set.copyOf(ids));
    }

    private BuildReferenceProvider provider(BuildReferenceKind kind) {
        var provider = providers.get(kind);
        if (provider == null)
            throw new IllegalStateException("No module answers build references of kind " + kind);
        return provider;
    }
}
