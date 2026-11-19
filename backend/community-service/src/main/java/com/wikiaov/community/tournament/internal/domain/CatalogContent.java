package com.wikiaov.community.tournament.internal.domain;

import java.util.List;
import java.util.UUID;

/** What the wiki catalog answers for the patch of a game: its heroes, items, arcana, enchantments and spells. */
public final class CatalogContent {
    private CatalogContent() {
    }

    public record Reference(
            UUID id,
            String code,
            String name,
            String iconUrl,
            Integer tier,
            String color,
            String branchCode,
            UUID revisionId
    ) {
    }

    public record Catalog(
            List<Reference> heroes,
            List<Reference> items,
            List<Reference> arcana,
            List<Reference> enchantments,
            List<Reference> spells,
            ResolvedContext resolvedContext
    ) {
        public Catalog {
            heroes = List.copyOf(heroes);
            items = List.copyOf(items);
            arcana = List.copyOf(arcana);
            enchantments = List.copyOf(enchantments);
            spells = List.copyOf(spells);
        }
    }

    public record ResolvedContext(
            String region,
            String locale,
            UUID rulesetId,
            UUID seasonId,
            String seasonName,
            UUID patchVariantId,
            String patchCode,
            String patchTitle,
            boolean unknown,
            boolean includeUnscoped
    ) {
    }
}
