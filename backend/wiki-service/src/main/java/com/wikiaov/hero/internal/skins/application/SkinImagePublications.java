package com.wikiaov.hero.internal.skins.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.SkinImagePublicationRequest;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import com.wikiaov.hero.internal.catalog.application.HeroQueries;
import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.hero.internal.domain.HeroContent.Skin;
import com.wikiaov.hero.internal.domain.HeroContent.Skins;
import com.wikiaov.hero.internal.domain.HeroImages;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SkinImagePublications {
    private final HeroStore store;
    private final HeroSections sections;
    private final HeroQueries queries;
    private final GameplayContexts contexts;
    private final HeroValidation validation;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    public SkinImagePublications(HeroStore store, HeroSections sections, HeroQueries queries,
            GameplayContexts contexts, HeroValidation validation, CurrentActor actors, AuditLog audit, Clock clock) {
        this.store = store;
        this.sections = sections;
        this.queries = queries;
        this.contexts = contexts;
        this.validation = validation;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }

    @PreAuthorize("hasAuthority('hero:write') and hasAuthority('hero:publish')")
    public HeroRevisionView publish(UUID heroId, SkinImagePublicationRequest input) {
        store.lockHero(heroId);
        var now = clock.instant();
        var context = contexts.resolve(input.region(), now);
        var source = queries.current(heroId, context, now)
                .orElseThrow(() -> new ApiException(HeroErrorCode.HERO_NOT_FOUND,
                        "No published hero is available in this context."));
        if (!source.id().equals(input.sourceRevisionId()))
            throw conflict("The published source changed. Reload the current hero before publishing images.",
                    Map.of("currentRevisionId", source.id()));

        var imageSource = store.revision(heroId, input.imageSourceRevisionId());
        if (!imageSource.state().equals("DRAFT") || !imageSource.rulesetId().equals(source.rulesetId()))
            throw HeroValidation.invalid("The image source must be this hero's draft in the published ruleset.");
        if (imageSource.version() != input.expectedImageSourceVersion())
            throw conflict("The image source draft changed. Reload its images before publishing.",
                    Map.of("currentVersion", imageSource.version()));
        if (!source.sections().containsKey(HeroSection.SKINS) || !imageSource.sections().containsKey(HeroSection.SKINS))
            throw HeroValidation.invalid("Both source revisions must contain a skins section.");

        var previous = (Skins) sections.content(HeroSection.SKINS, source.sections().get(HeroSection.SKINS));
        var collected = (Skins) sections.content(HeroSection.SKINS, imageSource.sections().get(HeroSection.SKINS));
        var merged = merge(previous, collected);
        if (Objects.equals(previous, merged))
            return source;
        validation.validatePublication(HeroSection.SKINS, merged);

        var actor = actors.require();
        var skinRevisionId = sections.create(heroId, HeroSection.SKINS, merged, actor, now);
        sections.publish(HeroSection.SKINS, skinRevisionId, heroId);
        var existing = store.revisions(heroId);
        var revision = publishedRevision(source, skinRevisionId, existing);
        store.insert(revision);
        audit.record(new AuditEntry(actor, "HERO_SKIN_IMAGES_PUBLISHED", "HERO", heroId, revision.getId(), null,
                1L, input.changeNote(),
                Map.of("sourceRevisionId", source.id(), "imageSourceRevisionId", imageSource.id())));

        return store.revision(heroId, revision.getId());
    }

    private static Skins merge(Skins previous, Skins collected) {
        Map<String, Skin> byKey = new HashMap<>();
        collected.skins().forEach(skin -> byKey.put(skin.skinKey(), skin));
        var incoming = new Skins(previous.skins().stream().map(skin -> {
            var image = byKey.get(skin.skinKey());
            if (image == null)
                return skin;
            return new Skin(skin.skinKey(), skin.displayOrder(), select(image.artAssetId(), skin.artAssetId()),
                    skin.rarityCode(), skin.translations(), select(image.headAssetId(), skin.headAssetId()),
                    select(image.portraitAssetId(), skin.portraitAssetId()), image.images());
        }).toList(), previous.sources());
        return (Skins) HeroImages.retain(previous, incoming);
    }

    private HeroRevision publishedRevision(HeroRevisionView source, UUID skinsId, List<HeroRevisionView> existing) {
        var actor = actors.require();
        var now = clock.instant();
        var entity = new HeroRevision();
        entity.setId(UUID.randomUUID());
        entity.setHeroId(source.heroId());
        entity.setRulesetId(source.rulesetId());
        entity.setRevisionNo(existing.stream().filter(r -> r.rulesetId().equals(source.rulesetId()))
                .mapToLong(HeroRevisionView::revisionNo).max().orElse(0) + 1);
        entity.setState("PUBLISHED");
        entity.setVersion(1);
        entity.setPublicationSequence(existing.stream()
                .filter(r -> r.rulesetId().equals(source.rulesetId()) && r.publicationSequence() != null)
                .mapToLong(HeroRevisionView::publicationSequence).max().orElse(0) + 1);
        entity.setPublishedAt(now);
        entity.setCause(Cause.VISUAL_UPDATE.name());
        entity.setSourceRevisionId(source.id());
        entity.setEffectiveFromPatchVariantId(source.effectiveFromPatchVariantId());
        entity.setProfileRevisionId(source.sections().get(HeroSection.PROFILE));
        entity.setOverviewRatingRevisionId(source.sections().get(HeroSection.OVERVIEW_RATINGS));
        entity.setCombatStatsRevisionId(source.sections().get(HeroSection.COMBAT_STATS));
        entity.setSkillsRevisionId(source.sections().get(HeroSection.SKILLS));
        entity.setSkinsRevisionId(skinsId);
        entity.setMediaBindingRevisionId(source.sections().get(HeroSection.MEDIA_BINDINGS));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        entity.setCreatedByIssuer(actor.issuer());
        entity.setCreatedBySubject(actor.subject());
        entity.setUpdatedByIssuer(actor.issuer());
        entity.setUpdatedBySubject(actor.subject());
        return entity;
    }

    private static UUID select(UUID incoming, UUID previous) {
        return incoming == null ? previous : incoming;
    }

    private static ApiException conflict(String detail, Map<String, Object> attributes) {
        return new ApiException(HeroErrorCode.HERO_REVISION_VERSION_CONFLICT, detail, attributes);
    }
}
