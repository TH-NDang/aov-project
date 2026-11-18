package com.wikiaov.item.internal.reference.infrastructure;

import com.wikiaov.item.internal.domain.ItemContent;
import com.wikiaov.item.internal.reference.persistence.ItemReferenceRepository;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.terminology.AdminReferenceProvider;
import com.wikiaov.terminology.PublicReferenceProvider;
import java.time.Clock;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Transactional(readOnly = true)
public class ItemPublicReferences implements PublicReferenceProvider, AdminReferenceProvider {
    private final ItemReferenceRepository references;
    private final GameplayContexts contexts;
    private final MediaAssets media;
    private final Clock clock;

    public ItemPublicReferences(ItemReferenceRepository references, GameplayContexts contexts, MediaAssets media,
            Clock clock) {
        this.references = references;
        this.contexts = contexts;
        this.media = media;
        this.clock = clock;
    }

    public List<AdminReferenceProvider.Candidate> references(UUID rulesetId, Map<UUID, Long> patchOrdinals) {
        var rows = references.authoring(rulesetId, patchOrdinals).stream()
                .map(row -> new AdminReferenceProvider.Row(row.id(), row.revisionId(), row.iconAssetId(), row.locale(),
                        row.name(), ItemContent.unwrapDescription(row.description())))
                .toList();
        return AdminReferenceProvider.candidates(rows, "item", rulesetId);
    }

    public List<PublicReferenceProvider.Candidate> references(String region, String locale) {
        var at = clock.instant();
        var context = contexts.resolve(region, at);
        var ordinals = contexts.rulesetVariants(context.rulesetId()).stream()
                .collect(Collectors.toMap(v -> v.id(), v -> v.rulesetOrdinal()));
        return references(new PublicReferenceProvider.Scope(context, ordinals, at), locale);
    }

    public List<PublicReferenceProvider.Candidate> references(PublicReferenceProvider.Scope scope, String locale) {
        var rows = references.published(scope.gameplay(), scope.patchOrdinals(), scope.allowUnscoped());
        var grouped = rows.stream().collect(Collectors.groupingBy(AdminReferenceProvider.Row::id,
                LinkedHashMap::new, Collectors.toList()));
        var assets = media.findAll(rows.stream().map(AdminReferenceProvider.Row::iconAssetId)
                .filter(Objects::nonNull).collect(Collectors.toSet()));
        var output = new ArrayList<PublicReferenceProvider.Candidate>();
        for (var values : grouped.values()) {
            var copy = values.stream().filter(t -> t.locale().equals(locale)).findFirst()
                    .or(() -> values.stream().filter(t -> t.locale().equals(CatalogLocales.DEFAULT)).findFirst())
                    .or(() -> values.stream().filter(t -> t.locale().equals("en-US")).findFirst())
                    .orElse(values.getFirst());
            var asset = copy.iconAssetId() == null ? null : assets.get(copy.iconAssetId());
            String icon = asset != null && asset.usable() ? asset.currentVersion().url() : null;
            output.add(new PublicReferenceProvider.Candidate(copy.id(), "item", copy.name(),
                    ItemContent.unwrapDescription(copy.description()), copy.locale(), icon));
        }
        return output;
    }
}
