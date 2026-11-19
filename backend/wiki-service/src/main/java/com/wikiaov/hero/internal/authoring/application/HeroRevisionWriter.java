package com.wikiaov.hero.internal.authoring.application;

import com.wikiaov.access.CurrentActor;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import com.wikiaov.hero.internal.domain.CharacterCodes;
import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.ProfileTranslation;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.RevisionState;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

/**
 * Writes heroes and their revisions for {@link HeroAuthoring}, inside its transaction: new heroes and drafts, the
 * sections a draft points at, and each change of state. Every change of a draft raises its version.
 */
@Component
public class HeroRevisionWriter {
    private final HeroStore store;
    private final HeroSections sections;
    private final CurrentActor actors;
    private final Clock clock;

    public HeroRevisionWriter(HeroStore store, HeroSections sections, CurrentActor actors, Clock clock) {
        this.store = store;
        this.sections = sections;
        this.actors = actors;
        this.clock = clock;
    }

    /** Creates the hero and returns its id; a code already in use is HERO_CODE_EXISTS. */
    UUID insertHero(String code) {
        var actor = actors.require();
        UUID id = UUID.randomUUID();
        try {
            var hero = new HeroIdentity();
            hero.setId(id);
            hero.setCode(CharacterCodes.hero(code));
            hero.setCreatedAt(clock.instant());
            hero.setCreatedByIssuer(actor.issuer());
            hero.setCreatedBySubject(actor.subject());
            store.insert(hero);
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(HeroErrorCode.HERO_CODE_EXISTS, "The hero code is already in use.");
        }
        return id;
    }

    /** Creates a draft numbered after the hero's latest revision in the ruleset and returns its id. */
    UUID insertDraft(UUID hero, UUID ruleset, @Nullable UUID source, Cause cause, @Nullable UUID effective) {
        long no = store.revisions(hero).stream().filter(r -> r.rulesetId().equals(ruleset))
                .mapToLong(HeroRevisionView::revisionNo).max().orElse(0) + 1;
        UUID id = UUID.randomUUID();
        var a = actors.require();
        var entity = new HeroRevision();
        entity.setId(id);
        entity.setHeroId(hero);
        entity.setRulesetId(ruleset);
        entity.setRevisionNo(no);
        entity.setState(RevisionState.DRAFT);
        entity.setVersion(1);
        entity.setCause(cause);
        entity.setSourceRevisionId(source);
        entity.setEffectiveFromPatchVariantId(effective);
        entity.setCreatedAt(clock.instant());
        entity.setUpdatedAt(clock.instant());
        entity.setCreatedByIssuer(a.issuer());
        entity.setCreatedBySubject(a.subject());
        entity.setUpdatedByIssuer(a.issuer());
        entity.setUpdatedBySubject(a.subject());

        store.insert(entity);

        return id;
    }

    /** Gives a new draft one new section of each kind; only the profile has content, the hero's name. */
    void createSections(UUID heroId, UUID draftId, String locale, String name) {
        var actor = actors.require();
        for (var section : HeroSection.values()) {
            Object content = section == HeroSection.PROFILE
                    ? new Profile(List.of(new ProfileTranslation(locale, name, null, null, null)), Set.of(), List.of())
                    : null;
            bind(draftId, section, sections.create(heroId, section, content, actor, clock.instant()));
        }
    }

    /** The draft at the version the editor read; anything else cannot be changed. */
    HeroRevisionView editable(UUID hero, UUID id, long expected) {
        var r = store.revision(hero, id);
        if (r.state() != RevisionState.DRAFT) {
            throw new ApiException(HeroErrorCode.HERO_REVISION_NOT_EDITABLE, "Only drafts can be changed.");
        }
        if (r.version() != expected) {
            throw new ApiException(HeroErrorCode.HERO_REVISION_VERSION_CONFLICT, "The draft has changed.",
                    Map.of("currentVersion", r.version()));
        }
        return r;
    }

    void bind(UUID draft, HeroSection section, UUID id) {
        var entity = store.editableEntity(draft);
        switch (section) {
            case PROFILE -> entity.setProfileRevisionId(id);
            case OVERVIEW_RATINGS -> entity.setOverviewRatingRevisionId(id);
            case COMBAT_STATS -> entity.setCombatStatsRevisionId(id);
            case SKILLS -> entity.setSkillsRevisionId(id);
            case SKINS -> entity.setSkinsRevisionId(id);
            case MEDIA_BINDINGS -> entity.setMediaBindingRevisionId(id);
        }
    }

    /** Stores the content as a new section and points the draft at it. */
    void replaceSection(UUID heroId, UUID draftId, HeroSection section, Object content) {
        UUID newId = sections.create(heroId, section, content, actors.require(), clock.instant());
        bind(draftId, section, newId);
        bump(draftId);
    }

    /** Moves an initial baseline draft to the patch it was observed at. */
    void observeAt(UUID draftId, UUID patchVariantId) {
        store.editableEntity(draftId).setEffectiveFromPatchVariantId(patchVariantId);
        bump(draftId);
    }

    /** Publishes the draft's sections and the draft, next in the publication order of its ruleset. */
    void publish(UUID heroId, HeroRevisionView draft) {
        long seq = store.revisions(heroId).stream()
                .filter(r -> r.rulesetId().equals(draft.rulesetId()) && r.publicationSequence() != null)
                .mapToLong(HeroRevisionView::publicationSequence).max().orElse(0) + 1;

        draft.sections().forEach((section, id) -> sections.publish(section, id, heroId));
        var entity = store.editableEntity(draft.id());
        entity.setState(RevisionState.PUBLISHED);
        entity.setPublicationSequence(seq);
        entity.setPublishedAt(clock.instant());
        bump(draft.id());
    }

    void discard(UUID draftId) {
        bump(draftId);
        store.editableEntity(draftId).setState(RevisionState.DISCARDED);
    }

    private void bump(UUID id) {
        var entity = store.editableEntity(id);
        var actor = actors.require();
        entity.setVersion(entity.getVersion() + 1);
        entity.setUpdatedAt(clock.instant());
        entity.setUpdatedByIssuer(actor.issuer());
        entity.setUpdatedBySubject(actor.subject());
    }
}
