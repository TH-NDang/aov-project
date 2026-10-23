package com.wikiaov.hero.internal.media.application;

import com.wikiaov.hero.internal.application.response.*;
import com.wikiaov.hero.internal.application.response.HeroMediaGroup;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.application.response.SkinBadgeRelation;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroContent.MediaRole;
import com.wikiaov.hero.internal.media.persistence.HeroMediaRepository;
import com.wikiaov.hero.internal.media.persistence.entity.HeroImageOption;
import com.wikiaov.hero.internal.media.persistence.entity.HeroImageOption.*;
import com.wikiaov.hero.internal.media.persistence.entity.MediaBindingRow;
import com.wikiaov.hero.internal.media.persistence.entity.MediaBindingRow.*;
import com.wikiaov.hero.internal.profile.persistence.entity.ProfileTranslationRow;
import com.wikiaov.hero.internal.profile.persistence.entity.ProfileTranslationRow.*;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinImageOption;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinImageOption.*;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinSnapshotRow;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinSnapshotRow.*;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinTranslationRow;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinTranslationRow.*;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchVariantReference;
import com.wikiaov.platform.PageSlice;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@PreAuthorize("hasAuthority('catalog:read')")
public class HeroMediaQueries {
    private final HeroMediaRepository repository;
    private final HeroStore store;
    private final GameplayContexts contexts;

    public HeroMediaQueries(HeroMediaRepository repository, HeroStore store, GameplayContexts contexts) {
        this.repository = repository;
        this.store = store;
        this.contexts = contexts;
    }

    public PageSlice<HeroMediaGroup> list(UUID rulesetId, MediaRole role, String locale, String q, int page, int size) {
        bounds(page, size);
        HeroValidation.locale(locale);
        if (q.trim().length() > 100)
            throw HeroValidation.invalid("Search must contain at most 100 characters.");
        var selected = repository.page(rulesetId, ordinals(rulesetId), q.trim().toLowerCase(Locale.ROOT), page, size);
        var content = content(selected.items(), locale);
        var views = store.revisions(selected.items().stream().map(HeroRevision::getHeroId).distinct().toList()).stream()
                .collect(Collectors.toMap(HeroRevisionView::id, Function.identity()));
        return selected.map(revision -> {
            var hero = content.heroes().get(revision.getHeroId());
            var text = profile(content, revision);
            String name = text == null ? hero.getCode() : text.getName();
            List<HeroMediaGroup.Entry> entries = new ArrayList<>();
            UUID main = content.bindings().getOrDefault(revision.getMediaBindingRevisionId(), List.of()).stream()
                    .filter(binding -> binding.getMediaRole().equals(role.name())).map(MediaBindingRow::getAssetId)
                    .findFirst().orElse(null);
            var options = content.heroOptions().getOrDefault(revision.getMediaBindingRevisionId(), List.of()).stream()
                    .filter(option -> option.getMediaRole().equals(role.name()))
                    .sorted(Comparator.comparingInt(HeroImageOption::getImageOrder))
                    .map(option -> new Option(option.getAssetId(), option.getLabel())).toList();
            entries(entries, "HERO", null, name, null, main, options);
            for (var skin : content.skins().getOrDefault(revision.getSkinsRevisionId(), List.of())) {
                var skinText = skinName(content, revision, skin.getSkinKey());
                UUID skinMain = switch (role) {
                    case HEAD -> skin.getHeadAssetId();
                    case PORTRAIT -> skin.getPortraitAssetId();
                    case SPLASH -> skin.getArtAssetId();
                };
                var skinOptions = content.skinOptions().getOrDefault(revision.getSkinsRevisionId(), List.of()).stream()
                        .filter(option -> option.getSkinKey().equals(skin.getSkinKey())
                                && option.getMediaRole().equals(role.name()))
                        .sorted(Comparator.comparingInt(SkinImageOption::getImageOrder))
                        .map(option -> new Option(option.getAssetId(), option.getLabel())).toList();
                entries(entries, "SKIN", skin.getSkinKey(), skinText, skin.getRarityCode(), skinMain, skinOptions);
            }
            var view = views.get(revision.getId());
            return new HeroMediaGroup(hero.getId(), hero.getCode(), name, text == null ? null : text.getLocale(), view,
                    entries);
        });
    }

    private record Option(
            UUID assetId,
            String label
    ) {
    }

    private static void entries(List<HeroMediaGroup.Entry> entries, String type, String skinKey, String name,
            String rarity, UUID main, List<Option> options) {
        String label = options.stream().filter(option -> option.assetId().equals(main)).map(Option::label)
                .filter(Objects::nonNull).findFirst().orElse(null);
        entries.add(new HeroMediaGroup.Entry(type, skinKey, name, main, label, true, rarity));
        options.stream().filter(option -> !option.assetId().equals(main)).forEach(option -> entries
                .add(new HeroMediaGroup.Entry(type, skinKey, name, option.assetId(), option.label(), false, rarity)));
    }

    public Map<String, Long> badgeCounts(UUID rulesetId) {
        var selected = repository.selected(rulesetId, ordinals(rulesetId));
        Set<UUID> sections = selected.stream().map(HeroRevision::getSkinsRevisionId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, Set<String>> seen = new HashMap<>();
        repository.skins(sections).stream()
                .filter(skin -> skin.getRarityCode() != null).forEach(skin -> seen
                        .computeIfAbsent(skin.getRarityCode(), ignored -> new HashSet<>())
                        .add(skin.getHeroId() + ":" + skin.getSkinKey()));
        return seen.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, value -> (long) value.getValue().size()));
    }

    public PageSlice<SkinBadgeRelation> badgeSkins(String code, UUID rulesetId, String locale, int page, int size) {
        bounds(page, size);
        HeroValidation.locale(locale);
        var selected = repository.selected(rulesetId, ordinals(rulesetId));
        var content = content(selected, locale);
        List<SkinBadgeRelation> rows = new ArrayList<>();
        for (var revision : selected) {
            var hero = content.heroes().get(revision.getHeroId());
            var text = profile(content, revision);
            for (var skin : content.skins().getOrDefault(revision.getSkinsRevisionId(), List.of())) {
                if (Objects.equals(skin.getRarityCode(), code))
                    rows.add(new SkinBadgeRelation(hero.getId(), hero.getCode(),
                            text == null ? hero.getCode() : text.getName(),
                            skin.getSkinKey(), skinName(content, revision, skin.getSkinKey()), revision.getId(),
                            skin.getArtAssetId()));
            }
        }
        int from = Math.min(page * size, rows.size());
        return new PageSlice<>(rows.subList(from, Math.min(from + size, rows.size())), page, size, rows.size());
    }

    private Map<UUID, Long> ordinals(UUID rulesetId) {
        if (rulesetId != null)
            contexts.requireRuleset(rulesetId);
        return contexts.catalogVariants(null).stream()
                .filter(variant -> rulesetId == null || variant.rulesetId().equals(rulesetId))
                .collect(Collectors.toMap(PatchVariantReference::id, PatchVariantReference::rulesetOrdinal));
    }

    private record Content(
            Map<UUID, HeroIdentity> heroes,
            Map<UUID, List<ProfileTranslationRow>> profiles,
            Map<UUID, List<MediaBindingRow>> bindings,
            Map<UUID, List<HeroImageOption>> heroOptions,
            Map<UUID, List<SkinSnapshotRow>> skins,
            Map<UUID, List<SkinTranslationRow>> skinNames,
            Map<UUID, List<SkinImageOption>> skinOptions,
            String locale
    ) {
    }

    private Content content(List<HeroRevision> revisions, String locale) {
        var heroIds = revisions.stream().map(HeroRevision::getHeroId).distinct().toList();
        var profiles = revisions.stream().map(HeroRevision::getProfileRevisionId).filter(Objects::nonNull).distinct()
                .toList();
        var media = revisions.stream().map(HeroRevision::getMediaBindingRevisionId).filter(Objects::nonNull).distinct()
                .toList();
        var skins = revisions.stream().map(HeroRevision::getSkinsRevisionId).filter(Objects::nonNull).distinct()
                .toList();
        return new Content(repository.heroes(heroIds).stream()
                .collect(Collectors.toMap(HeroIdentity::getId, Function.identity())),
                repository.profiles(profiles).stream()
                        .collect(Collectors.groupingBy(ProfileTranslationRow::getProfileRevisionId)),
                repository.bindings(media).stream()
                        .collect(Collectors.groupingBy(MediaBindingRow::getMediaBindingRevisionId)),
                repository.heroImages(media).stream()
                        .collect(Collectors.groupingBy(HeroImageOption::getMediaBindingRevisionId)),
                repository.skins(skins).stream()
                        .sorted(Comparator.comparingInt(SkinSnapshotRow::getDisplayOrder))
                        .collect(Collectors.groupingBy(SkinSnapshotRow::getSkinSetRevisionId)),
                repository.skinTranslations(skins).stream()
                        .collect(Collectors.groupingBy(SkinTranslationRow::getSkinSetRevisionId)),
                repository.skinImages(skins).stream()
                        .collect(Collectors.groupingBy(SkinImageOption::getSkinSetRevisionId)),
                locale);
    }

    private static ProfileTranslationRow profile(Content content, HeroRevision revision) {
        return content.profiles().getOrDefault(revision.getProfileRevisionId(), List.of()).stream()
                .min(Comparator
                        .<ProfileTranslationRow>comparingInt(text -> localeRank(text.getLocale(), content.locale()))
                        .thenComparing(ProfileTranslationRow::getLocale))
                .orElse(null);
    }

    private static String skinName(Content content, HeroRevision revision, String key) {
        return content.skinNames().getOrDefault(revision.getSkinsRevisionId(), List.of()).stream()
                .filter(text -> text.getSkinKey().equals(key))
                .min(Comparator.<SkinTranslationRow>comparingInt(text -> localeRank(text.getLocale(), content.locale()))
                        .thenComparing(SkinTranslationRow::getLocale))
                .map(SkinTranslationRow::getName).orElse(key);
    }

    public static int localeRank(String locale, String requested) {
        return locale.equals(requested) ? 0 : locale.equals("vi-VN") ? 1 : locale.equals("en-US") ? 2 : 3;
    }

    public static void bounds(int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE)
            throw HeroValidation.invalid("Invalid page bounds.");
    }
}
