package com.wikiaov.hero.internal.application.service;

import com.wikiaov.hero.internal.domain.SkillReferenceSearch;
import com.wikiaov.hero.internal.persistence.HeroSkillImageRepository;
import com.wikiaov.hero.internal.persistence.HeroSkillReferenceRepository;
import com.wikiaov.hero.internal.persistence.HeroSkillReferenceRepository.Copy;
import com.wikiaov.hero.internal.persistence.HeroSkillReferenceRepository.Row;
import com.wikiaov.hero.internal.persistence.entity.HeroSkillImage;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.terminology.SkillReferenceProvider;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class HeroSkillReferenceQueries implements SkillReferenceProvider {
    private final HeroSkillReferenceRepository references;
    private final HeroSkillImageRepository images;
    private final GameplayContexts contexts;
    private final MediaAssets media;

    public HeroSkillReferenceQueries(HeroSkillReferenceRepository references, HeroSkillImageRepository images,
            GameplayContexts contexts, MediaAssets media) {
        this.references = references;
        this.images = images;
        this.contexts = contexts;
        this.media = media;
    }

    public PageSlice<Candidate> admin(UUID rulesetId, String q, UUID heroId, List<String> ids, int page, int size) {
        var result = references.search(rulesetId, Map.of(), null, null, SkillReferenceSearch.parse(q), heroId, ids,
                page, size);
        return hydrate(result, rulesetId, null, null, page, size);
    }

    public PageSlice<Candidate> published(GameplayContext context, Instant at, String locale, String q, UUID heroId,
            List<String> ids, int page, int size) {
        var ordinals = contexts.rulesetVariants(context.rulesetId()).stream()
                .collect(Collectors.toMap(v -> v.id(), v -> v.rulesetOrdinal()));
        var result = references.search(context.rulesetId(), ordinals, at, context.rulesetOrdinal(),
                SkillReferenceSearch.parse(q), heroId, ids, page, size);
        return hydrate(result, context.rulesetId(), context.regionCode(), locale, page, size);
    }

    private PageSlice<Candidate> hydrate(HeroSkillReferenceRepository.Result result, UUID rulesetId, String region,
            String locale, int page, int size) {
        var rows = result.items();
        if (rows.isEmpty())
            return new PageSlice<>(List.of(), page, size, result.totalElements());
        boolean publicRead = region != null;
        var skillCopies = references.skills(rows).stream()
                .collect(Collectors.groupingBy(c -> key(c.sectionId(), c.skillKey())));
        var ownerCopies = references.owners(rows).stream().collect(Collectors.groupingBy(Copy::sectionId));
        Map<UUID, List<HeroSkillImage>> library = publicRead
                ? Map.of()
                : images.findByHeroIdIn(rows.stream().map(Row::heroId).distinct().toList()).stream()
                        .collect(Collectors.groupingBy(HeroSkillImage::getHeroId));
        var icons = new HashMap<String, Icon>();
        var assetIds = new HashSet<UUID>();
        for (var row : rows) {
            var icon = icon(row, library.getOrDefault(row.heroId(), List.of()));
            icons.put(key(row.skillSetRevisionId(), row.skillKey()), icon);
            if (icon.id() != null)
                assetIds.add(icon.id());
            if (row.headAssetId() != null)
                assetIds.add(row.headAssetId());
        }
        var assets = publicRead ? media.findAll(assetIds) : Map.<UUID, MediaAssetReference>of();
        var candidates = new ArrayList<Candidate>();
        for (var row : rows) {
            var icon = icons.get(key(row.skillSetRevisionId(), row.skillKey()));
            var skillTranslations = translations(skillCopies.getOrDefault(key(row.skillSetRevisionId(), row.skillKey()),
                    List.of()), row.skillKey(), locale);
            var ownerTranslations = translations(ownerCopies.getOrDefault(row.profileRevisionId(), List.of()),
                    row.code(), locale);
            var owner = new Owner(row.heroId(), "hero", ownerTranslations, publicRead ? null : row.headAssetId(),
                    publicRead ? url(assets, row.headAssetId()) : null);
            var destinations = new Destinations(publicRead
                    ? null
                    : "/hero/" + row.heroId() + "?revision="
                            + row.revisionId() + "&ruleset=" + rulesetId + "&tab=skills&skill=" + row.skillKey(),
                    publicRead
                            ? "/?hero=" + row.heroId() + "&region=" + region + "&locale=" + locale
                                    + "&tab=skills&skill=" + row.skillKey()
                            : null);
            candidates.add(new Candidate(row.heroId() + "." + row.skillKey(), "skill", row.heroId(), row.skillKey(),
                    row.revisionId(), SkillReferenceSearch.sourceSlot(row.skillKey()),
                    SkillReferenceSearch.variantNo(row.skillKey()), row.formKey(), skillTranslations,
                    publicRead ? null : icon.id(), publicRead ? url(assets, icon.id()) : null,
                    icon.source(), false, destinations, owner));
        }
        return new PageSlice<>(candidates, page, size, result.totalElements());
    }

    private static List<Translation> translations(List<Copy> copies, String fallback, String locale) {
        var values = copies.stream().map(c -> new Translation(c.locale(), c.name(), List.of(), c.description()))
                .toList();
        if (values.isEmpty())
            return List.of(new Translation(locale == null ? "vi-VN" : locale, fallback, List.of(), ""));
        if (locale == null)
            return values;
        var selected = values.stream().filter(c -> c.locale().equals(locale)).findFirst()
                .or(() -> values.stream().filter(c -> c.locale().equals("vi-VN")).findFirst())
                .orElse(values.getFirst());
        return List.of(selected);
    }

    private static String key(UUID section, String skillKey) {
        return section + ":" + skillKey;
    }

    private static String url(Map<UUID, MediaAssetReference> assets, UUID id) {
        var asset = id == null ? null : assets.get(id);
        return asset != null && asset.usable() ? asset.currentVersion().url() : null;
    }

    private record Icon(
            UUID id,
            String source
    ) {
    }

    private static Icon icon(Row row, List<HeroSkillImage> library) {
        if (row.iconAssetId() != null)
            return new Icon(row.iconAssetId(), "REVISION");
        var exact = library.stream().filter(i -> row.skillKey().equals(i.getSkillKey())).toList();
        if (!exact.isEmpty())
            return exact.size() == 1 ? new Icon(exact.getFirst().getAssetId(), "LIBRARY") : new Icon(null, null);
        Integer slot = SkillReferenceSearch.sourceSlot(row.skillKey());
        Integer variant = SkillReferenceSearch.variantNo(row.skillKey());
        if (slot == null || variant == null)
            return new Icon(null, null);
        var matching = library.stream().filter(i -> i.getSkillKey() == null && i.getSourceSlot() == slot
                && i.getVariantNo() == variant).toList();
        return matching.size() == 1 ? new Icon(matching.getFirst().getAssetId(), "LIBRARY") : new Icon(null, null);
    }
}
