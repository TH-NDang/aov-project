package com.wikiaov.hero.internal.badges.persistence;

import com.wikiaov.hero.internal.badges.persistence.entity.SkinBadgeGroupTranslation;
import com.wikiaov.hero.internal.badges.persistence.entity.SkinBadgeTranslation;

import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class SkinBadgeTexts {
    private final SkinBadgeTranslationRepository badges;
    private final SkinBadgeGroupTranslationRepository groups;

    public List<SkinBadgeTranslation> badges(Collection<UUID> ids) {
        return ids.isEmpty() ? List.of() : badges.findByBadgeIdIn(ids, Sort.unsorted());
    }

    public List<SkinBadgeGroupTranslation> groups(Collection<UUID> ids) {
        return ids.isEmpty() ? List.of() : groups.findByGroupIdIn(ids, Sort.unsorted());
    }

    public void replaceBadgeTranslations(UUID id, List<SkinBadgeTranslation> translations) {
        Map<String, SkinBadgeTranslation> incoming = new HashMap<>();
        translations.forEach(text -> incoming.put(text.getLocale(), text));
        for (var old : badges(List.of(id))) {
            var next = incoming.remove(old.getLocale());
            if (next == null)
                badges.delete(old);
            else {
                old.setDisplayName(next.getDisplayName());
                old.setIconAssetId(next.getIconAssetId());
            }
        }
        badges.saveAll(incoming.values());
        badges.flush();
    }

    public void replaceBadgeGroupTranslations(UUID id, List<SkinBadgeGroupTranslation> translations) {
        Map<String, SkinBadgeGroupTranslation> incoming = new HashMap<>();
        translations.forEach(text -> incoming.put(text.getLocale(), text));
        for (var old : groups(List.of(id))) {
            var next = incoming.remove(old.getLocale());
            if (next == null)
                groups.delete(old);
            else
                old.setDisplayName(next.getDisplayName());
        }
        groups.saveAll(incoming.values());
        groups.flush();
    }
}
