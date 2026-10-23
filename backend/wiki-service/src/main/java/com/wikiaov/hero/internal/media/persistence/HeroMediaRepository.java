package com.wikiaov.hero.internal.media.persistence;

import com.wikiaov.hero.internal.authoring.persistence.HeroRevisionRepository;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import com.wikiaov.hero.internal.media.persistence.entity.HeroImageOption;
import com.wikiaov.hero.internal.media.persistence.entity.MediaBindingRow;
import com.wikiaov.hero.internal.profile.persistence.entity.ProfileTranslationRow;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinImageOption;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinSnapshotRow;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinTranslationRow;

import com.wikiaov.platform.PageSlice;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class HeroMediaRepository {
    private final HeroRevisionRepository revisions;
    private final HeroMediaRows rows;

    public PageSlice<HeroRevision> page(UUID ruleset, Map<UUID, Long> ordinals, String q, int page, int size) {
        var selected = revisions.findAll(HeroMediaSpecifications.selected(ruleset, ordinals, q, true),
                PageRequest.of(page, size));
        return new PageSlice<>(selected.getContent(), page, size, selected.getTotalElements());
    }

    public List<HeroRevision> selected(UUID ruleset, Map<UUID, Long> ordinals) {
        return revisions.findAll(HeroMediaSpecifications.selected(ruleset, ordinals, "", false));
    }

    public List<HeroIdentity> heroes(Collection<UUID> ids) {
        return ids.isEmpty() ? List.of() : rows.heroes(ids);
    }

    public List<ProfileTranslationRow> profiles(Collection<UUID> ids) {
        return ids.isEmpty() ? List.of() : rows.profiles(ids);
    }

    public List<MediaBindingRow> bindings(Collection<UUID> ids) {
        return ids.isEmpty() ? List.of() : rows.bindings(ids);
    }

    public List<HeroImageOption> heroImages(Collection<UUID> ids) {
        return ids.isEmpty() ? List.of() : rows.heroImages(ids);
    }

    public List<SkinSnapshotRow> skins(Collection<UUID> ids) {
        return ids.isEmpty() ? List.of() : rows.skins(ids);
    }

    public List<SkinTranslationRow> skinTranslations(Collection<UUID> ids) {
        return ids.isEmpty() ? List.of() : rows.skinTranslations(ids);
    }

    public List<SkinImageOption> skinImages(Collection<UUID> ids) {
        return ids.isEmpty() ? List.of() : rows.skinImages(ids);
    }

}
