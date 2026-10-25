package com.wikiaov.hero.internal.skins.application;

import com.wikiaov.hero.internal.application.response.PublicSkinCatalogView;
import com.wikiaov.hero.internal.application.response.PublicSkinCatalogView.*;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.skins.persistence.PublicSkinCatalogRepository;
import com.wikiaov.hero.internal.skins.persistence.PublicSkinCatalogRepository.*;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.PageSlice;
import java.text.Normalizer;
import java.time.Clock;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PublicSkinCatalog {
    private final PublicSkinCatalogRepository repository;
    private final GameplayContexts contexts;
    private final MediaAssets media;
    private final Clock clock;

    public PublicSkinCatalog(PublicSkinCatalogRepository repository, GameplayContexts contexts, MediaAssets media,
            Clock clock) {
        this.repository = repository;
        this.contexts = contexts;
        this.media = media;
        this.clock = clock;
    }

    public PublicSkinCatalogView read(String region, String locale, String q, String hero, String rarity, int page,
            int size) {
        validate(locale, q, hero, rarity, page, size);
        var at = clock.instant();
        var context = contexts.resolve(region, at);
        var selected = selectCurrent(repository.candidates(context.rulesetId(), at), context);
        if (selected.isEmpty())
            return new PublicSkinCatalogView(new PageSlice<>(List.of(), page, size, 0), List.of(), List.of());

        var catalog = localize(selected, locale);
        var heroes = catalog.stream().map(row -> new Filter(row.hero().getHeroCode(), row.heroName())).distinct()
                .sorted(Comparator.comparing(Filter::code)).toList();
        var rarities = catalog.stream().filter(row -> row.skin().getRarityCode() != null)
                .map(row -> new Filter(row.skin().getRarityCode(), row.badge() == null
                        ? row.skin().getRarityCode()
                        : row.badge().getName()))
                .distinct().sorted(Comparator.comparing(Filter::code)).toList();
        String[] search = normalized(q).split("\\s+");
        var matching = catalog.stream()
                .filter(row -> hero == null || hero.equals(row.hero().getHeroCode()))
                .filter(row -> rarity == null || rarity.equals(row.skin().getRarityCode()))
                .filter(row -> matches(row, search))
                .sorted(Comparator.comparing((Localized row) -> row.hero().getHeroCode())
                        .thenComparingInt(row -> row.skin().getDisplayOrder())
                        .thenComparing(row -> row.skin().getSkinKey()))
                .toList();

        long offset = (long) page * size;
        var slice = offset >= matching.size()
                ? List.<Localized>of()
                : matching.subList((int) offset, (int) Math.min(offset + size, matching.size()));
        var items = hydrate(slice);
        return new PublicSkinCatalogView(new PageSlice<>(items, page, size, matching.size()), heroes, rarities);
    }

    private List<Candidate> selectCurrent(List<Candidate> candidates, GameplayContext context) {
        Map<UUID, Long> ordinals = new HashMap<>();
        Function<Candidate, Long> ordinal = candidate -> candidate.getVariantId() == null
                ? 0
                : ordinals.computeIfAbsent(candidate.getVariantId(), id -> contexts.variant(id).rulesetOrdinal());
        var order = Comparator.comparing(ordinal).thenComparing(Candidate::getPublicationSequence);
        Map<UUID, Candidate> selected = new HashMap<>();
        for (var candidate : candidates) {
            if (ordinal.apply(candidate) <= context.rulesetOrdinal())
                selected.merge(candidate.getHeroId(), candidate, (left, right) -> order.compare(left, right) >= 0
                        ? left
                        : right);
        }
        return selected.values().stream().sorted(Comparator.comparing(Candidate::getHeroCode)).toList();
    }

    private List<Localized> localize(List<Candidate> heroes, String locale) {
        var profileIds = heroes.stream().map(Candidate::getProfileId).filter(Objects::nonNull).distinct().toList();
        var skinsIds = heroes.stream().map(Candidate::getSkinsId).filter(Objects::nonNull).distinct().toList();
        var profiles = profileIds.isEmpty()
                ? Map.<UUID, List<ProfileText>>of()
                : repository.profileTexts(profileIds).stream()
                        .collect(Collectors.groupingBy(ProfileText::getProfileId));
        if (skinsIds.isEmpty())
            return List.of();
        var skins = repository.skins(skinsIds);
        var texts = repository.skinTexts(skinsIds).stream()
                .collect(Collectors.groupingBy(text -> new SkinKey(text.getSkinsId(), text.getSkinKey())));
        var codes = skins.stream().map(Skin::getRarityCode).filter(Objects::nonNull).distinct().toList();
        var badgeTexts = codes.isEmpty()
                ? Map.<String, List<BadgeText>>of()
                : repository.badgeTexts(codes).stream().collect(Collectors.groupingBy(BadgeText::getCode));
        var byRevision = skins.stream().collect(Collectors.groupingBy(Skin::getSkinsId));

        List<Localized> result = new ArrayList<>();
        for (var hero : heroes) {
            var profile = translation(hero.getProfileId() == null
                    ? List.of()
                    : profiles.getOrDefault(hero.getProfileId(), List.of()), locale,
                    ProfileText::getLocale);
            String heroName = profile == null ? hero.getHeroCode() : profile.getName();
            for (var skin : byRevision.getOrDefault(hero.getSkinsId(), List.of())) {
                if (isBaseAppearance(hero.getHeroCode(), skin.getSkinKey()))
                    continue;

                var text = translation(texts.getOrDefault(new SkinKey(skin.getSkinsId(), skin.getSkinKey()), List.of()),
                        locale, SkinText::getLocale);
                var badge = translation(skin.getRarityCode() == null
                        ? List.of()
                        : badgeTexts.getOrDefault(skin.getRarityCode(), List.of()), locale,
                        BadgeText::getLocale);
                result.add(new Localized(hero, heroName, skin, text == null ? skin.getSkinKey() : text.getName(),
                        text == null ? null : text.getLocale(), badge));
            }
        }
        return result;
    }

    private static boolean isBaseAppearance(String heroCode, String skinKey) {
        return skinKey.equals(heroCode + "-mac-dinh-1") || skinKey.equals(heroCode + "-heroskin-1")
                || skinKey.equals(heroCode + "-default-1") || skinKey.equals("default");
    }

    private List<Entry> hydrate(List<Localized> rows) {
        if (rows.isEmpty())
            return List.of();
        var bindingIds = rows.stream().map(row -> row.hero().getBindingsId()).filter(Objects::nonNull).distinct()
                .toList();
        Map<UUID, UUID> heads = new HashMap<>();
        if (!bindingIds.isEmpty())
            repository.heads(bindingIds).forEach(head -> heads.put(head.getBindingsId(), head.getAssetId()));
        Set<UUID> assetIds = new HashSet<>(heads.values());
        for (var row : rows) {
            add(assetIds, row.skin().getPortraitId(), row.skin().getHeadId(), row.skin().getArtId());
            if (row.badge() != null)
                add(assetIds, row.badge().getIconId());
        }

        var assets = media.findAll(assetIds);
        return rows.stream().map(row -> new Entry(row.hero().getHeroId(), row.hero().getHeroCode(), row.heroName(),
                usable(assets, heads.get(row.hero().getBindingsId())), row.skin().getSkinKey(), row.skinName(),
                row.actualLocale(), row.skin().getRarityCode(), badge(row.badge(), assets),
                usable(assets, row.skin().getPortraitId()), usable(assets, row.skin().getHeadId()),
                usable(assets, row.skin().getArtId()))).toList();
    }

    private static Badge badge(BadgeText text, Map<UUID, MediaAssetReference> assets) {
        return text == null
                ? null
                : new Badge(text.getCode(), text.getName(), text.getLocale(),
                        usable(assets, text.getIconId()));
    }

    private static MediaAssetReference usable(Map<UUID, MediaAssetReference> assets, UUID id) {
        var asset = id == null ? null : assets.get(id);
        return asset != null && asset.usable() ? asset : null;
    }

    private static void add(Set<UUID> assets, UUID... ids) {
        for (var id : ids)
            if (id != null)
                assets.add(id);
    }

    private static <T> T translation(List<T> values, String locale, Function<T, String> language) {
        return values.stream().min(Comparator.comparingInt((T value) -> language.apply(value).equals(locale)
                ? 0
                : language.apply(value).equals("vi-VN") ? 1 : 2).thenComparing(language)).orElse(null);
    }

    private static String normalized(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .replace('đ', 'd').replace('Đ', 'D').toLowerCase(Locale.ROOT).trim();
    }

    private static boolean matches(Localized row, String[] terms) {
        String text = normalized(row.skinName() + " " + row.heroName() + " " + row.hero().getHeroCode() + " "
                + row.skin().getSkinKey());
        return Arrays.stream(terms).allMatch(text::contains);
    }

    private static void validate(String locale, String q, String hero, String rarity, int page, int size) {
        HeroValidation.locale(locale);
        if (q.length() > 120 || page < 0 || size < 1 || size > 60)
            throw HeroValidation.invalid(
                    "Search text must be at most 120 characters; page must be nonnegative and size between 1 and 60.");
        if ((hero != null && (hero.isBlank() || hero.length() > 200))
                || (rarity != null && (rarity.isBlank() || rarity.length() > 64)))
            throw HeroValidation.invalid("Hero and rarity filters must be nonblank valid codes.");
    }

    private record SkinKey(
            UUID skinsId,
            String skinKey
    ) {
    }

    private record Localized(
            Candidate hero,
            String heroName,
            Skin skin,
            String skinName,
            String actualLocale,
            BadgeText badge
    ) {
    }
}
