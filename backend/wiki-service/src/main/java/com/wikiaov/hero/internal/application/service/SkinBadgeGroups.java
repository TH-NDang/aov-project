package com.wikiaov.hero.internal.application.service;

import com.wikiaov.access.*;
import com.wikiaov.hero.internal.application.*;
import com.wikiaov.hero.internal.application.response.SkinBadgeGroupView;
import com.wikiaov.hero.internal.persistence.*;
import com.wikiaov.hero.internal.persistence.entity.*;
import com.wikiaov.platform.*;
import java.time.Clock;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SkinBadgeGroups {
    private final SkinBadgeGroupRepository groups;
    private final SkinBadgeRepository badges;
    private final HeroMediaRepository repository;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    public SkinBadgeGroups(SkinBadgeGroupRepository groups, SkinBadgeRepository badges,
            HeroMediaRepository repository, CurrentActor actors, AuditLog audit, Clock clock) {
        this.groups = groups;
        this.badges = badges;
        this.repository = repository;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public PageSlice<SkinBadgeGroupView> list(String locale, String q, int page, int size) {
        HeroMediaQueries.bounds(page, size);
        HeroValidation.locale(locale);
        String search = SkinBadges.search(q);
        var all = groups.findAll(Sort.by("code").and(Sort.by("id")));
        var translations = repository.rows(SkinBadgeGroupTranslation.class, "groupId",
                all.stream().map(SkinBadgeGroup::getId).toList()).stream()
                .collect(Collectors.groupingBy(SkinBadgeGroupTranslation::getGroupId));
        var allBadges = badges.findAll();
        var badgeTranslations = repository.rows(SkinBadgeTranslation.class, "badgeId",
                allBadges.stream().map(SkinBadge::getId).toList()).stream()
                .collect(Collectors.groupingBy(SkinBadgeTranslation::getBadgeId));
        List<SkinBadgeGroupView> matching = new ArrayList<>();
        for (var group : all) {
            var texts = translations.getOrDefault(group.getId(), List.of());
            boolean groupMatch = !search.isEmpty() && (contains(group.getCode(), search)
                    || texts.stream().anyMatch(text -> contains(text.getDisplayName(), search)));
            long count = allBadges.stream().filter(badge -> group.getId().equals(badge.getGroupId()))
                    .filter(badge -> groupMatch || SkinBadges.matches(badge,
                            badgeTranslations.getOrDefault(badge.getId(), List.of()), search))
                    .count();
            if (search.isEmpty() || groupMatch || count > 0)
                matching.add(view(group, texts, locale, count, groupMatch));
        }
        long unassigned = allBadges.stream().filter(badge -> badge.getGroupId() == null)
                .filter(badge -> SkinBadges.matches(badge,
                        badgeTranslations.getOrDefault(badge.getId(), List.of()), search))
                .count();
        if (search.isEmpty() || unassigned > 0)
            matching.add(new SkinBadgeGroupView(null, "__ungrouped", null, 0, List.of(), null, null, true,
                    unassigned, false));
        int from = Math.min(page * size, matching.size());
        return new PageSlice<>(matching.subList(from, Math.min(from + size, matching.size())), page, size,
                matching.size());
    }

    @Transactional
    @PreAuthorize("hasAuthority('hero:write')")
    public SkinBadgeGroupView create(SkinBadgeGroupCommands.Create input) {
        validate(input.translations());
        var group = new SkinBadgeGroup();
        group.setId(UUID.randomUUID());
        group.setCode(input.code());
        group.setKind(input.kind());
        group.setCreatedAt(clock.instant());
        group.setUpdatedAt(clock.instant());
        try {
            groups.saveAndFlush(group);
        } catch (DataIntegrityViolationException failure) {
            throw new ApiException(HeroErrorCode.HERO_BADGE_GROUP_CONFLICT, "The badge group code already exists.");
        }
        var translations = rows(group.getId(), input.translations());
        repository.replaceBadgeGroupTranslations(group.getId(), translations);
        audit.record(AuditEntry.of(actors.require(), "SKIN_BADGE_GROUP_CREATED", "SKIN_BADGE_GROUP", group.getId()));
        return view(group, translations, "vi-VN", 0, false);
    }

    @Transactional
    @PreAuthorize("hasAuthority('hero:write')")
    public SkinBadgeGroupView update(UUID id, SkinBadgeGroupCommands.Update input) {
        var group = groups.lock(id).orElseThrow(SkinBadgeGroups::missing);
        if (group.getVersion() != input.expectedVersion())
            throw new ApiException(HeroErrorCode.HERO_BADGE_GROUP_CONFLICT,
                    "The badge group changed. Reload before saving.");
        validate(input.translations());
        group.setKind(input.kind());
        group.setVersion(Math.addExact(group.getVersion(), 1));
        group.setUpdatedAt(clock.instant());
        var translations = rows(id, input.translations());
        repository.replaceBadgeGroupTranslations(id, translations);
        groups.flush();
        audit.record(new AuditEntry(actors.require(), "SKIN_BADGE_GROUP_UPDATED", "SKIN_BADGE_GROUP", id,
                null, input.expectedVersion(), group.getVersion(), null, Map.of()));
        long count = badges.findAll().stream().filter(badge -> id.equals(badge.getGroupId())).count();
        return view(group, translations, "vi-VN", count, false);
    }

    public void require(UUID id) {
        if (id != null && !groups.existsById(id))
            throw missing();
    }

    private static ApiException missing() {
        return new ApiException(HeroErrorCode.HERO_BADGE_GROUP_NOT_FOUND, "The badge group does not exist.");
    }

    private static boolean contains(String value, String search) {
        return value.toLowerCase(Locale.ROOT).contains(search);
    }

    private static void validate(List<SkinBadgeGroupCommands.Translation> translations) {
        Set<String> locales = new HashSet<>();
        for (var text : translations) {
            HeroValidation.locale(text.locale());
            if (!locales.add(text.locale()))
                throw HeroValidation.invalid("Badge group translation locales must be unique.");
        }
    }

    private static List<SkinBadgeGroupTranslation> rows(UUID id,
            List<SkinBadgeGroupCommands.Translation> translations) {
        return translations.stream().map(text -> new SkinBadgeGroupTranslation(id, text.locale(), text.displayName()))
                .toList();
    }

    private static SkinBadgeGroupView view(SkinBadgeGroup group, List<SkinBadgeGroupTranslation> translations,
            String locale, long count, boolean matchedByGroup) {
        var ordered = translations.stream().sorted(Comparator.comparing(SkinBadgeGroupTranslation::getLocale)).toList();
        var selected = ordered.stream()
                .min(Comparator.comparingInt(text -> HeroMediaQueries.localeRank(text.getLocale(), locale)))
                .orElse(null);
        return new SkinBadgeGroupView(group.getId(), group.getCode(), group.getKind(), group.getVersion(),
                ordered.stream()
                        .map(text -> new SkinBadgeGroupView.Translation(text.getLocale(), text.getDisplayName()))
                        .toList(),
                selected == null ? group.getCode() : selected.getDisplayName(),
                selected == null ? null : selected.getLocale(),
                selected == null || !selected.getLocale().equals(locale), count, matchedByGroup);
    }
}
