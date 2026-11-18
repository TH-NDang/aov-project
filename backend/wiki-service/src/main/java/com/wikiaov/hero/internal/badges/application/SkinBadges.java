package com.wikiaov.hero.internal.badges.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.hero.internal.alias.persistence.IdentifierAliases;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.SkinBadgeCommands;
import com.wikiaov.hero.internal.application.response.SkinBadgeRelation;
import com.wikiaov.hero.internal.application.response.SkinBadgeView;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.badges.domain.SkinBadgeKind;
import com.wikiaov.hero.internal.badges.persistence.SkinBadgeRepository;
import com.wikiaov.hero.internal.badges.persistence.SkinBadgeTexts;
import com.wikiaov.hero.internal.badges.persistence.entity.SkinBadge;
import com.wikiaov.hero.internal.badges.persistence.entity.SkinBadgeTranslation;
import com.wikiaov.hero.internal.media.application.HeroMediaQueries;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogAggregates;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.PageSlice;
import java.time.Clock;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SkinBadges {
    private final SkinBadgeRepository badges;
    private final SkinBadgeTexts repository;
    private final HeroMediaQueries gallery;
    private final MediaAssets media;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;
    private final SkinBadgeGroups groups;
    private final IdentifierAliases aliases;

    public SkinBadges(SkinBadgeRepository badges, SkinBadgeTexts repository, HeroMediaQueries gallery,
            MediaAssets media, CurrentActor actors, AuditLog audit, Clock clock, SkinBadgeGroups groups,
            IdentifierAliases aliases) {
        this.badges = badges;
        this.repository = repository;
        this.gallery = gallery;
        this.media = media;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
        this.groups = groups;
        this.aliases = aliases;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public PageSlice<SkinBadgeView> list(UUID rulesetId, String locale, String q, UUID groupId,
            boolean ungrouped, int page, int size) {
        HeroMediaQueries.bounds(page, size);
        HeroValidation.locale(locale);
        if (groupId != null && ungrouped) {
            throw HeroValidation.invalid("Choose either a badge group or ungrouped badges.");
        }
        groups.require(groupId);
        String search = search(q);

        var found = badges.findAll(SkinBadgeRepository.listed(groupId, ungrouped, search),
                PageRequest.of(page, size, Sort.by("code").and(Sort.by("id"))));
        var translations = translations(found.getContent().stream().map(SkinBadge::getId).toList());
        var counts = gallery.badgeCounts(rulesetId);

        return new PageSlice<>(found.getContent().stream()
                .map(badge -> view(badge, translations.getOrDefault(badge.getId(), List.of()), locale,
                        counts.getOrDefault(badge.getCode(), 0L)))
                .toList(), page, size, found.getTotalElements());
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public PageSlice<SkinBadgeRelation> skins(UUID id, UUID rulesetId, String locale, int page, int size) {
        return gallery.badgeSkins(require(id).getCode(), rulesetId, locale, page, size);
    }

    @Transactional
    @PreAuthorize("hasAuthority('hero:write')")
    public SkinBadgeView create(SkinBadgeCommands.Create input) {
        validate(input.translations());
        groups.require(input.groupId());
        var badge = new SkinBadge();
        badge.setId(UUID.randomUUID());
        String code = input.code();
        if (code == null) {
            if (input.translations().isEmpty()) {
                throw HeroValidation.invalid("A badge name is required to generate its code.");
            }
            String region = input.regionCode() == null ? "vn" : input.regionCode();
            if (!region.equals("global") && !Locale.getISOCountries(Locale.IsoCountryCode.PART1_ALPHA2)
                    .contains(region.toUpperCase(Locale.ROOT))) {
                throw HeroValidation.invalid("The badge region must be an ISO country code or global.");
            }
            try {
                code = aliases.nextBadgeCode(input.translations().getFirst().displayName(),
                        region);
            } catch (IllegalArgumentException invalid) {
                throw HeroValidation.invalid(invalid.getMessage());
            }
        }
        badge.setCode(code);
        badge.setKind(SkinBadgeKind.valueOf(input.kind()));
        badge.setGroupId(input.groupId());
        badge.setCreatedAt(clock.instant());
        badge.setUpdatedAt(clock.instant());
        try {
            badges.saveAndFlush(badge);
        } catch (DataIntegrityViolationException failure) {
            throw new ApiException(HeroErrorCode.HERO_BADGE_CONFLICT, "The skin badge code already exists.");
        }
        var translations = rows(badge.getId(), input.translations());
        repository.replaceBadgeTranslations(badge.getId(), translations);
        audit.record(
                AuditEntry.of(actors.require(), "SKIN_BADGE_CREATED", CatalogAggregates.SKIN_BADGE, badge.getId()));
        return view(badge, translations, CatalogLocales.DEFAULT, 0);
    }

    @Transactional
    @PreAuthorize("hasAuthority('hero:write')")
    public SkinBadgeView update(UUID id, SkinBadgeCommands.Update input) {
        var badge = badges.lock(id).orElseThrow(() -> missing());
        if (badge.getVersion() != input.expectedVersion()) {
            throw new ApiException(HeroErrorCode.HERO_BADGE_CONFLICT, "The skin badge changed. Reload before saving.");
        }
        validate(input.translations());
        badge.setKind(SkinBadgeKind.valueOf(input.kind()));
        badge.setVersion(Math.addExact(badge.getVersion(), 1));
        badge.setUpdatedAt(clock.instant());
        var translations = rows(id, input.translations());
        repository.replaceBadgeTranslations(id, translations);
        badges.flush();
        audit.record(new AuditEntry(actors.require(), "SKIN_BADGE_UPDATED", CatalogAggregates.SKIN_BADGE, id, null,
                input.expectedVersion(), badge.getVersion(), null, Map.of()));
        return view(badge, translations, CatalogLocales.DEFAULT,
                gallery.badgeCounts(null).getOrDefault(badge.getCode(), 0L));
    }

    @Transactional
    @PreAuthorize("hasAuthority('hero:write')")
    public SkinBadgeView assignGroup(UUID id, SkinBadgeCommands.AssignGroup input) {
        var badge = badges.lock(id).orElseThrow(SkinBadges::missing);
        if (badge.getVersion() != input.expectedVersion()) {
            throw new ApiException(HeroErrorCode.HERO_BADGE_CONFLICT, "The skin badge changed. Reload before saving.");
        }
        groups.require(input.groupId());
        UUID previous = badge.getGroupId();
        badge.setGroupId(input.groupId());
        badge.setVersion(Math.addExact(badge.getVersion(), 1));
        badge.setUpdatedAt(clock.instant());
        badges.flush();
        Map<String, Object> detail = new HashMap<>();
        if (previous != null) {
            detail.put("previousGroupId", previous.toString());
        }
        if (input.groupId() != null) {
            detail.put("groupId", input.groupId().toString());
        }
        audit.record(
                new AuditEntry(actors.require(), "SKIN_BADGE_GROUP_ASSIGNED", CatalogAggregates.SKIN_BADGE, id, null,
                        input.expectedVersion(), badge.getVersion(), null, detail));
        return view(badge, translations(List.of(id)).getOrDefault(id, List.of()), CatalogLocales.DEFAULT,
                gallery.badgeCounts(null).getOrDefault(badge.getCode(), 0L));
    }

    static String search(String q) {
        if (q.trim().length() > 100) {
            throw HeroValidation.invalid("Search must contain at most 100 characters.");
        }
        return q.trim().toLowerCase(Locale.ROOT);
    }

    static boolean matches(SkinBadge badge, List<SkinBadgeTranslation> translations, String search) {
        return badge.getCode().toLowerCase(Locale.ROOT).contains(search) || translations.stream()
                .anyMatch(text -> text.getDisplayName().toLowerCase(Locale.ROOT).contains(search));
    }

    private void validate(List<SkinBadgeCommands.Translation> translations) {
        Set<String> locales = new HashSet<>();
        for (var translation : translations) {
            HeroValidation.locale(translation.locale());
            if (!locales.add(translation.locale())) {
                throw HeroValidation.invalid("Badge translation locales must be unique.");
            }
            if (translation.iconAssetId() != null) {
                var asset = media.find(translation.iconAssetId()).orElseThrow(() -> new ApiException(
                        HeroErrorCode.HERO_INVALID_MEDIA, "The badge icon does not exist."));
                if (!asset.usable() || asset.semanticType() != MediaSemanticType.SKIN_BADGE) {
                    throw new ApiException(HeroErrorCode.HERO_INVALID_MEDIA,
                            "Badge icons must be usable SKIN_BADGE assets.");
                }
            }
        }
    }

    private SkinBadge require(UUID id) {
        return badges.findById(id).orElseThrow(() -> missing());
    }

    private static ApiException missing() {
        return new ApiException(HeroErrorCode.HERO_BADGE_NOT_FOUND, "The skin badge does not exist.");
    }

    private Map<UUID, List<SkinBadgeTranslation>> translations(List<UUID> ids) {
        return repository.badges(ids).stream()
                .collect(Collectors.groupingBy(SkinBadgeTranslation::getBadgeId));
    }

    private static List<SkinBadgeTranslation> rows(UUID id, List<SkinBadgeCommands.Translation> translations) {
        return translations.stream()
                .map(text -> new SkinBadgeTranslation(id, text.locale(), text.displayName(), text.iconAssetId()))
                .toList();
    }

    private static SkinBadgeView view(SkinBadge badge, List<SkinBadgeTranslation> translations, String locale,
            long count) {
        var ordered = translations.stream().sorted(Comparator.comparing(SkinBadgeTranslation::getLocale)).toList();
        var selected = CatalogLocales.pick(ordered, locale, SkinBadgeTranslation::getLocale);
        return new SkinBadgeView(badge.getId(), badge.getCode(), badge.getKind(), badge.getGroupId(),
                badge.getVersion(),
                ordered.stream()
                        .map(text -> new SkinBadgeView.Translation(text.getLocale(), text.getDisplayName(),
                                text.getIconAssetId()))
                        .toList(),
                selected == null ? badge.getCode() : selected.getDisplayName(),
                selected == null ? null : selected.getIconAssetId(),
                selected == null ? null : selected.getLocale(),
                selected == null || !selected.getLocale().equals(locale), count);
    }
}
