package com.wikiaov.query.internal.application;

import com.wikiaov.hero.HeroChangeQueries;
import com.wikiaov.patch.PatchCatalog;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogChangeProvider;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.PlatformErrorCode;
import com.wikiaov.spell.SpellChangeQueries;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;

/** The public patch pages: the list, one patch and the changes it made to one catalog domain (03, Patch APIs). */
@Service
public class PatchPages {
    private static final Set<String> LEGACY_DOMAINS = Set.of("HERO", "SPELL");

    private final PatchCatalog patches;
    private final HeroChangeQueries heroes;
    private final SpellChangeQueries spells;
    private final List<CatalogChangeProvider> catalogs;

    public PatchPages(PatchCatalog patches, HeroChangeQueries heroes, SpellChangeQueries spells,
            List<CatalogChangeProvider> catalogs) {
        this.patches = patches;
        this.heroes = heroes;
        this.spells = spells;
        this.catalogs = catalogs;
    }

    public PageSlice<Map<String, Object>> list(String region, String locale, int page, int size) {
        return patches.list(region, locale, page, size);
    }

    public Map<String, Object> detail(UUID id, String region, String locale) {
        return patches.published(id, region, locale);
    }

    /** One page of the changes a patch made to one domain, in the order the domain's provider returns them. */
    public PatchChangesPage changes(UUID id, String region, String locale, String domain,
            @Nullable UUID patchVariantId, int page, int size) {
        Optional<CatalogChangeProvider> provider = catalogs.stream()
                .filter(catalog -> domain.equals(catalog.domain())).findFirst();
        if (!LEGACY_DOMAINS.contains(domain) && provider.isEmpty())
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                    "This domain does not have an implemented change provider.");

        var patch = patchVariantId == null
                ? patches.published(id, region, locale)
                : patches.publishedVariant(id, patchVariantId, region, locale);
        UUID variant = (UUID) patch.get("variantId");
        List<Map<String, Object>> all = changes(domain, provider, patch, variant, locale);

        var slice = PageSlice.of(all, page, size);
        return new PatchChangesPage(patch, variant, patch.get("effectiveAt"), slice.items(), page, size,
                slice.totalElements());
    }

    private List<Map<String, Object>> changes(String domain, Optional<CatalogChangeProvider> provider,
            Map<String, Object> patch, UUID variant, String locale) {
        if (domain.equals("HERO"))
            return heroes.forVariant(variant, locale);
        List<Map<String, Object>> legacy = domain.equals("SPELL") ? spells.forVariant(variant, locale) : List.of();
        return provider.map(catalog -> PublishedCatalogChanges.forVariant(catalog, (UUID) patch.get("rulesetId"),
                variant, locale, legacy)).orElse(legacy);
    }
}
