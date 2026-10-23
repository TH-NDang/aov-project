package com.wikiaov.hero.internal.skins.persistence;

import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.badges.persistence.SkinBadgeRepository;
import com.wikiaov.hero.internal.badges.persistence.entity.SkinBadge;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionLifecycle;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSnapshots;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSources;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinIdentityRow;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinImageOption;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinSnapshotRow;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinTranslationRow;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinsRevision;
import com.wikiaov.platform.ApiException;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class HeroSkinSnapshots implements HeroSectionSnapshots {
    private final SkinsRevisionRepository revisions;
    private final SkinIdentityRepository identities;
    private final SkinSnapshotRepository snapshots;
    private final SkinTranslationRepository translations;
    private final SkinImageOptionRepository images;
    private final SkinBadgeRepository badges;
    private final HeroSectionLifecycle lifecycle;
    private final HeroSectionSources sources;

    @Override
    public HeroSection section() {
        return HeroSection.SKINS;
    }

    @Override
    public UUID create(UUID heroId, Object content, Actor actor, Instant at) {
        var revision = lifecycle.create(revisions, new SkinsRevision(), heroId, actor, at);
        if (content != null) {
            var value = (Skins) content;
            value.skins().forEach(skin -> save(heroId, revision.getId(), skin, at));
            sources.save(section(), revision.getId(), value.sources());
        }
        revisions.flush();
        return revision.getId();
    }

    private void save(UUID heroId, UUID revisionId, Skin skin, Instant at) {
        ensureBadge(skin.rarityCode(), at);
        if (identities.findById(new SkinIdentityRow.Key(heroId, skin.skinKey())).isEmpty())
            identities.save(new SkinIdentityRow(heroId, skin.skinKey(), at));
        identities.flush();
        snapshots.saveAndFlush(new SkinSnapshotRow(revisionId, heroId, skin.skinKey(), skin.displayOrder(),
                skin.artAssetId(), skin.rarityCode(), skin.headAssetId(), skin.portraitAssetId()));
        skin.images().forEach((role, options) -> {
            for (int n = 0; n < options.size(); n++)
                images.save(new SkinImageOption(revisionId, skin.skinKey(), role.name(), n,
                        options.get(n).assetId(), options.get(n).label()));
        });
        translations.saveAll(skin.translations().stream().map(t -> new SkinTranslationRow(revisionId,
                skin.skinKey(), t.locale(), t.name(), t.description(), t.acquisitionNote())).toList());
    }

    private void ensureBadge(String code, Instant at) {
        if (code == null || badges.findByCode(code).isPresent())
            return;
        var badge = new SkinBadge();
        badge.setId(UUID.randomUUID());
        badge.setCode(code);
        badge.setKind("UNKNOWN");
        badge.setCreatedAt(at);
        badge.setUpdatedAt(at);
        try {
            badges.saveAndFlush(badge);
        } catch (DataIntegrityViolationException failure) {
            throw new ApiException(HeroErrorCode.HERO_BADGE_CONFLICT,
                    "The badge catalog changed concurrently. Retry the hero change.");
        }
    }

    @Override
    public Skins content(UUID id) {
        var references = sources.find(section(), id);
        var ids = Collections.singletonList(id);
        var texts = translations.findBySkinSetRevisionIdIn(ids, Sort.by("locale")).stream()
                .collect(Collectors.groupingBy(SkinTranslationRow::getSkinKey));
        var options = images.findBySkinSetRevisionIdIn(ids, Sort.by("imageOrder")).stream()
                .collect(Collectors.groupingBy(SkinImageOption::getSkinKey));
        return new Skins(snapshots.findBySkinSetRevisionIdIn(ids, Sort.by("displayOrder")).stream()
                .map(s -> new Skin(s.getSkinKey(), s.getDisplayOrder(), s.getArtAssetId(), s.getRarityCode(),
                        texts.getOrDefault(s.getSkinKey(), List.of()).stream()
                                .map(t -> new SkinTranslation(t.getLocale(), t.getName(), t.getDescription(),
                                        t.getAcquisitionNote()))
                                .toList(),
                        s.getHeadAssetId(), s.getPortraitAssetId(),
                        images(options.getOrDefault(s.getSkinKey(), List.of()))))
                .toList(), references);
    }

    private static Map<MediaRole, List<ImageOption>> images(List<SkinImageOption> options) {
        Map<MediaRole, List<ImageOption>> result = new EnumMap<>(MediaRole.class);
        options.forEach(option -> result
                .computeIfAbsent(MediaRole.valueOf(option.getMediaRole()), ignored -> new ArrayList<>())
                .add(new ImageOption(option.getAssetId(), option.getLabel())));
        return result;
    }

    @Override
    public void publish(UUID id, UUID heroId) {
        lifecycle.publish(revisions, id, heroId);
    }
}
