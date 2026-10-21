package com.wikiaov.hero.internal.application.service;

import com.wikiaov.access.*;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.HeroSkillImageCommand;
import com.wikiaov.hero.internal.application.response.HeroSkillImageView;
import com.wikiaov.hero.internal.persistence.*;
import com.wikiaov.hero.internal.persistence.entity.HeroSkillImage;
import com.wikiaov.media.*;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class HeroSkillImages {
    private final HeroIdentityRepository heroes;
    private final HeroSkillImageRepository images;
    private final SkillIdentityRepository skills;
    private final MediaAssets media;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    public HeroSkillImages(HeroIdentityRepository heroes, HeroSkillImageRepository images,
            SkillIdentityRepository skills, MediaAssets media, CurrentActor actors, AuditLog audit, Clock clock) {
        this.heroes = heroes;
        this.images = images;
        this.skills = skills;
        this.media = media;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public List<HeroSkillImageView> list(UUID heroId) {
        if (!heroes.existsById(heroId))
            throw new ApiException(HeroErrorCode.HERO_NOT_FOUND, "The hero does not exist.");
        return images.findByHeroIdOrderBySourceSlotAscVariantNoAsc(heroId).stream().map(HeroSkillImages::view).toList();
    }

    @Transactional
    @PreAuthorize("hasAuthority('hero:write')")
    public HeroSkillImageView save(UUID heroId, int sourceSlot, int variantNo, HeroSkillImageCommand input) {
        heroes.lockById(heroId).orElseThrow(() -> new ApiException(HeroErrorCode.HERO_NOT_FOUND,
                "The hero does not exist."));
        if (sourceSlot < 0 || sourceSlot > 99 || variantNo < 1 || variantNo > 100
                || input.sourceFilename().contains("/") || input.sourceFilename().contains("\\")
                || input.sourceFilename().equals(".") || input.sourceFilename().equals(".."))
            throw new ApiException(HeroErrorCode.HERO_INVALID_CONTENT, "Invalid skill image source identity.");
        if (input.skillKey() != null && !skills.existsByHeroIdAndSkillKey(heroId, input.skillKey()))
            throw new ApiException(HeroErrorCode.HERO_INVALID_CONTENT,
                    "A skill image can only link to an existing skill identity.");
        if (media.find(input.assetId()).filter(a -> a.usable() && a.semanticType() == MediaSemanticType.HERO_SKILL_ICON)
                .isEmpty())
            throw new ApiException(HeroErrorCode.HERO_INVALID_MEDIA, "Use an active uploaded hero skill icon.");
        var existing = images.findByHeroIdAndSourceSlotAndVariantNo(heroId, sourceSlot, variantNo);
        if (existing.isPresent()) {
            var row = existing.get();
            if (Objects.equals(row.getAssetId(), input.assetId()) && Objects.equals(row.getSkillKey(), input.skillKey())
                    && Objects.equals(row.getSourceFilename(), input.sourceFilename())
                    && Objects.equals(row.getLabel(), input.label()))
                return view(row);
            if (row.getVersion() != input.expectedVersion())
                conflict(row.getVersion());
        } else if (input.expectedVersion() != -1)
            conflict(-1);
        var row = existing.orElseGet(() -> {
            var created = new HeroSkillImage();
            created.setId(UUID.randomUUID());
            created.setHeroId(heroId);
            created.setSourceSlot(sourceSlot);
            created.setVariantNo(variantNo);
            created.setCreatedAt(clock.instant());
            created.setVersion(0);
            return created;
        });
        long before = row.getVersion();
        row.setAssetId(input.assetId());
        row.setSkillKey(input.skillKey());
        row.setSourceFilename(input.sourceFilename());
        row.setLabel(input.label());
        row.setVersion(before + 1);
        row.setUpdatedAt(clock.instant());
        images.saveAndFlush(row);
        audit.record(new AuditEntry(actors.require(), "HERO_SKILL_IMAGE_SAVED", "HERO", heroId, null,
                existing.isEmpty() ? null : before, row.getVersion(), null,
                Map.of("imageId", row.getId(), "slot", sourceSlot, "variant", variantNo, "assetId", row.getAssetId())));
        return view(row);
    }

    private static void conflict(long version) {
        throw new ApiException(HeroErrorCode.HERO_SKILL_IMAGE_CONFLICT, "The skill image has changed.",
                Map.of("currentVersion", version));
    }
    private static HeroSkillImageView view(HeroSkillImage row) {
        return new HeroSkillImageView(row.getId(), row.getHeroId(), row.getSkillKey(), row.getSourceSlot(),
                row.getVariantNo(), row.getAssetId(), row.getSourceFilename(), row.getLabel(), row.getVersion(),
                row.getCreatedAt(), row.getUpdatedAt());
    }
}
