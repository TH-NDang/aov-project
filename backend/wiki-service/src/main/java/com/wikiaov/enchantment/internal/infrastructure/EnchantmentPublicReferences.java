package com.wikiaov.enchantment.internal.infrastructure;

import com.wikiaov.enchantment.internal.persistence.EnchantmentReferenceRepository;
import com.wikiaov.media.*;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.terminology.AdminReferenceProvider;
import com.wikiaov.terminology.PublicReferenceProvider;
import java.time.Clock;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Transactional(readOnly = true)
public class EnchantmentPublicReferences implements PublicReferenceProvider, AdminReferenceProvider {
    private final EnchantmentReferenceRepository references;
    private final GameplayContexts contexts;
    private final MediaAssets media;
    private final Clock clock;

    public EnchantmentPublicReferences(EnchantmentReferenceRepository references, GameplayContexts contexts,
            MediaAssets media,
            Clock clock) {
        this.references = references;
        this.contexts = contexts;
        this.media = media;
        this.clock = clock;
    }

    public List<AdminReferenceProvider.Candidate> references(UUID rulesetId, Map<UUID, Long> patchOrdinals) {
        return AdminReferenceProvider.candidates(references.authoring(rulesetId, patchOrdinals), "enchantment",
                rulesetId);
    }

    public List<PublicReferenceProvider.Candidate> references(String region, String locale) {
        var at = clock.instant();
        var context = contexts.resolve(region, at);
        var ordinals = contexts.rulesetVariants(context.rulesetId()).stream()
                .collect(Collectors.toMap(v -> v.id(), v -> v.rulesetOrdinal()));
        return references(new PublicReferenceProvider.Scope(context, ordinals, at), locale);
    }

    public List<PublicReferenceProvider.Candidate> references(PublicReferenceProvider.Scope scope, String locale) {
        var rows = references.published(scope.gameplay(), scope.patchOrdinals());
        var grouped = rows.stream().collect(Collectors.groupingBy(AdminReferenceProvider.Row::id,
                LinkedHashMap::new, Collectors.toList()));
        var assets = media.findAll(rows.stream().map(AdminReferenceProvider.Row::iconAssetId)
                .filter(Objects::nonNull).collect(Collectors.toSet()));
        var output = new ArrayList<PublicReferenceProvider.Candidate>();
        for (var values : grouped.values()) {
            var copy = values.stream().filter(t -> t.locale().equals(locale)).findFirst()
                    .or(() -> values.stream().filter(t -> t.locale().equals("vi-VN")).findFirst())
                    .or(() -> values.stream().filter(t -> t.locale().equals("en-US")).findFirst())
                    .orElse(values.getFirst());
            var asset = copy.iconAssetId() == null ? null : assets.get(copy.iconAssetId());
            String icon = asset != null && asset.usable() ? asset.currentVersion().url() : null;
            output.add(new PublicReferenceProvider.Candidate(copy.id(), "enchantment", copy.name(), copy.description(),
                    copy.locale(), icon));
        }
        return output;
    }
}
