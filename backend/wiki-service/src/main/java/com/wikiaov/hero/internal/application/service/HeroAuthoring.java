package com.wikiaov.hero.internal.application.service;

import com.wikiaov.access.*;
import com.wikiaov.hero.internal.application.*;
import com.wikiaov.hero.internal.application.HeroCommands.*;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.domain.CharacterCodes;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroImages;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.persistence.*;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchDataReviews;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class HeroAuthoring {
    private final PatchDataReviews dataReviews;
    private final HeroStore store;
    private final HeroSections sections;
    private final HeroValidation validation;
    private final GameplayContexts contexts;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;
    private final IdentifierAliases aliases;
    public HeroAuthoring(PatchDataReviews dataReviews, HeroStore store, HeroSections sections,
            HeroValidation validation, GameplayContexts contexts,
            CurrentActor actors, AuditLog audit, Clock clock, IdentifierAliases aliases) {
        this.dataReviews = dataReviews;
        this.store = store;
        this.sections = sections;
        this.validation = validation;
        this.contexts = contexts;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
        this.aliases = aliases;
    }

    @PreAuthorize("hasAuthority('hero:write')")
    public HeroRevisionView create(Create input) {
        contexts.requireRuleset(input.rulesetId());
        var target = contexts.authoringContext(input.contextId());
        if (!target.rulesetId().equals(input.rulesetId()))
            throw HeroValidation.invalid("The release does not belong to the selected ruleset.");
        HeroValidation.locale(input.initialLocale());
        var actor = actors.require();
        UUID id = UUID.randomUUID();
        try {
            var hero = new com.wikiaov.hero.internal.persistence.entity.HeroIdentity();
            hero.setId(id);
            hero.setCode(CharacterCodes.hero(input.code()));
            hero.setCreatedAt(clock.instant());
            hero.setCreatedByIssuer(actor.issuer());
            hero.setCreatedBySubject(actor.subject());
            store.insert(hero);
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(HeroErrorCode.HERO_CODE_EXISTS, "The hero code is already in use.");
        }
        UUID draft = insertDraft(id, input.rulesetId(), null, Cause.DATA_BASELINE, target.patchVariantId());
        for (var section : HeroSection.values()) {
            Object content = section == HeroSection.PROFILE
                    ? new Profile(
                            List.of(new ProfileTranslation(input.initialLocale(), input.name(), null, null, null)),
                            Set.of(), List.of())
                    : null;
            UUID sectionId = sections.create(id, section, content, actor, clock.instant());
            bind(draft, section, sectionId);
        }
        record("HERO_CREATED", id, draft, null, 1L, null);
        return store.revision(id, draft);
    }

    @PreAuthorize("hasAuthority('hero:write')")
    public HeroRevisionView fork(UUID heroId, Fork input) {
        store.lockHero(heroId);
        contexts.requireRuleset(input.rulesetId());
        var draft = store.revisions(heroId).stream()
                .filter(r -> r.rulesetId().equals(input.rulesetId()) && r.state().equals("DRAFT")).findFirst();
        if (draft.isPresent())
            throw new ApiException(HeroErrorCode.HERO_DRAFT_EXISTS, "This hero already has a draft for the ruleset.",
                    Map.of("existingDraftId", draft.get().id()));
        var source = input.sourceRevisionId() == null
                ? defaultSource(heroId, input)
                : store.revision(heroId, input.sourceRevisionId());
        if (!source.rulesetId().equals(input.rulesetId()) || !source.state().equals("PUBLISHED"))
            throw HeroValidation.invalid("The source must be published and belong to the target hero and ruleset.");
        UUID effective = input.effectiveFromPatchVariantId() == null
                ? source.effectiveFromPatchVariantId()
                : input.effectiveFromPatchVariantId();
        checkContext(input.rulesetId(), input.cause(), effective, false);
        if (effective != null && ordinal(source) > contexts.variant(effective).rulesetOrdinal())
            throw HeroValidation.invalid("A future snapshot cannot be used to reconstruct an earlier patch.");
        if (input.cause() == Cause.DATA_BASELINE)
            throw HeroValidation.invalid("Use an independent baseline import instead of copying another snapshot.");
        if (input.cause() != Cause.GAME_PATCH && !Objects.equals(effective, source.effectiveFromPatchVariantId()))
            throw HeroValidation.invalid("Content corrections must retain source gameplay applicability.");
        UUID id = insertDraft(heroId, input.rulesetId(), source.id(), input.cause(), effective);
        source.sections().forEach((s, ref) -> bind(id, s, ref));
        record("HERO_DRAFT_CREATED", heroId, id, null, 1L, input.changeNote());
        return store.revision(heroId, id);
    }

    @PreAuthorize("hasAuthority('hero:write')")
    public HeroRevisionView baseline(UUID heroId, UUID contextId, String locale, String name) {
        store.lockHero(heroId);
        var target = contexts.authoringContext(contextId);
        if (store.revisions(heroId).stream().anyMatch(r -> r.rulesetId().equals(target.rulesetId())
                && r.state().equals("DRAFT")))
            throw new ApiException(HeroErrorCode.HERO_DRAFT_EXISTS, "Finish or discard the existing draft first.");
        UUID draft = insertDraft(heroId, target.rulesetId(), null, Cause.DATA_BASELINE, target.patchVariantId());
        for (var section : HeroSection.values()) {
            Object content = section == HeroSection.PROFILE
                    ? new Profile(List.of(new ProfileTranslation(locale, name, null, null, null)), Set.of(), List.of())
                    : null;
            bind(draft, section, sections.create(heroId, section, content, actors.require(), clock.instant()));
        }
        record("HERO_BASELINE_CREATED", heroId, draft, null, 1L, "Independent observed snapshot");
        return store.revision(heroId, draft);
    }

    @PreAuthorize("hasAuthority('hero:write')")
    public HeroRevisionView baselineContext(UUID heroId, UUID draftId, BaselineContext input) {
        store.lockHero(heroId);
        var draft = editable(heroId, draftId, input.expectedVersion());
        if (draft.cause() != Cause.DATA_BASELINE || draft.sourceRevisionId() != null)
            throw HeroValidation
                    .invalid("Only an independent initial baseline draft can change its observation context.");
        if (store.revisions(heroId).stream().anyMatch(revision -> revision.rulesetId().equals(draft.rulesetId())
                && revision.state().equals("PUBLISHED")))
            throw HeroValidation.invalid("A published history exists. Create a separate historical baseline instead.");
        var target = contexts.authoringContext(input.contextId());
        if (!target.rulesetId().equals(draft.rulesetId()))
            throw HeroValidation.invalid("The baseline observation context must keep the same ruleset.");
        if (Objects.equals(draft.effectiveFromPatchVariantId(), target.patchVariantId()))
            return draft;
        store.editableEntity(draftId).setEffectiveFromPatchVariantId(target.patchVariantId());
        bump(draftId);
        record("HERO_BASELINE_CONTEXT_CHANGED", heroId, draftId, draft.version(), draft.version() + 1,
                "Observation context changed from " + draft.effectiveFromPatchVariantId() + " to "
                        + target.patchVariantId());
        return store.revision(heroId, draftId);
    }

    @PreAuthorize("hasAuthority('hero:write')")
    public HeroRevisionView update(UUID heroId, UUID draftId, HeroSection section, long expected, Object content,
            String note) {
        store.lockHero(heroId);
        var draft = editable(heroId, draftId, expected);
        validation.validate(section, content);
        if (content instanceof Skins skins)
            content = aliases.skins(heroId, skins);
        if (content instanceof Bindings bindings)
            content = aliases.bindings(bindings);
        validation.validate(section, content);
        Object old = sections.content(section, draft.sections().get(section));
        content = HeroImages.retain(old, content);
        validation.validate(section, content);
        if (Objects.equals(old, content))
            return draft;
        UUID newId = sections.create(heroId, section, content, actors.require(), clock.instant());
        bind(draftId, section, newId);
        bump(draftId);
        record("HERO_SECTION_UPDATED", heroId, draftId, expected, expected + 1, note);
        return store.revision(heroId, draftId);
    }

    @PreAuthorize("hasAuthority('hero:publish')")
    public HeroRevisionView publish(UUID heroId, UUID draftId, Mutation input) {
        store.lockHero(heroId);
        var draft = editable(heroId, draftId, input.expectedVersion());
        checkContext(draft.rulesetId(), draft.cause(), draft.effectiveFromPatchVariantId(), true);
        if (draft.sections().size() != HeroSection.values().length)
            throw HeroValidation.invalid("All hero sections are required.");
        for (var section : HeroSection.values())
            validation.validatePublication(section, sections.content(section, draft.sections().get(section)));
        var bindings = (Bindings) sections.content(HeroSection.MEDIA_BINDINGS,
                draft.sections().get(HeroSection.MEDIA_BINDINGS));
        if (!bindings.bindings().keySet().equals(EnumSet.allOf(MediaRole.class)))
            throw HeroValidation.invalid("HEAD, PORTRAIT and SPLASH bindings are required for publication.");
        var profile = (Profile) sections.content(HeroSection.PROFILE, draft.sections().get(HeroSection.PROFILE));
        var locales = profile.translations().stream().map(ProfileTranslation::locale)
                .collect(java.util.stream.Collectors.toSet());
        var skills = (Skills) sections.content(HeroSection.SKILLS, draft.sections().get(HeroSection.SKILLS));
        if (skills.skills().stream().anyMatch(s -> !s.translations().stream().map(SkillTranslation::locale)
                .collect(java.util.stream.Collectors.toSet()).containsAll(locales)))
            throw HeroValidation.invalid("Every skill needs translations for all profile locales.");
        long seq = store.revisions(heroId).stream()
                .filter(r -> r.rulesetId().equals(draft.rulesetId()) && r.publicationSequence() != null)
                .mapToLong(HeroRevisionView::publicationSequence).max().orElse(0) + 1;
        draft.sections().forEach((section, id) -> sections.publish(section, id, heroId));
        var entity = store.editableEntity(draftId);
        entity.setState("PUBLISHED");
        entity.setPublicationSequence(seq);
        entity.setPublishedAt(clock.instant());
        bump(draftId);
        if (draft.cause() == Cause.DATA_BASELINE || draft.cause() == Cause.GAME_PATCH)
            dataReviews.markDirty(draft.effectiveFromPatchVariantId());
        record("HERO_PUBLISHED", heroId, draftId, input.expectedVersion(), input.expectedVersion() + 1,
                input.changeNote());
        return store.revision(heroId, draftId);
    }

    @PreAuthorize("hasAuthority('hero:write')")
    public HeroRevisionView discard(UUID heroId, UUID draftId, Mutation input) {
        store.lockHero(heroId);
        editable(heroId, draftId, input.expectedVersion());
        bump(draftId);
        store.editableEntity(draftId).setState("DISCARDED");
        record("HERO_DRAFT_DISCARDED", heroId, draftId, input.expectedVersion(), input.expectedVersion() + 1,
                input.changeNote());
        return store.revision(heroId, draftId);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public HeroRevisionView read(UUID heroId, UUID revisionId) {
        return store.revision(heroId, revisionId);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<HeroRevisionView> revisions(UUID heroId) {
        return store.revisions(heroId);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public Map<HeroSection, Object> preview(UUID heroId, UUID revisionId) {
        var rev = store.revision(heroId, revisionId);
        Map<HeroSection, Object> result = new EnumMap<>(HeroSection.class);
        rev.sections().forEach((s, id) -> result.put(s, sections.content(s, id)));
        return result;
    }

    private HeroRevisionView defaultSource(UUID heroId, Fork input) {
        long limit = input.effectiveFromPatchVariantId() == null
                ? contexts.active(clock.instant()).stream().filter(c -> c.rulesetId().equals(input.rulesetId()))
                        .mapToLong(com.wikiaov.patch.GameplayContext::rulesetOrdinal).max()
                        .orElseThrow(() -> HeroValidation
                                .invalid("Specify a published source when no regional context is active."))
                : contexts.variant(input.effectiveFromPatchVariantId()).rulesetOrdinal();
        return store.revisions(heroId).stream().filter(
                r -> r.rulesetId().equals(input.rulesetId()) && r.state().equals("PUBLISHED") && ordinal(r) <= limit)
                .max(Comparator.<HeroRevisionView>comparingLong(this::ordinal)
                        .thenComparingLong(HeroRevisionView::publicationSequence))
                .orElseThrow(() -> HeroValidation.invalid("A published source revision is required."));
    }

    private long ordinal(HeroRevisionView revision) {
        return revision.effectiveFromPatchVariantId() == null
                ? 0
                : contexts.variant(revision.effectiveFromPatchVariantId()).rulesetOrdinal();
    }

    private UUID insertDraft(UUID hero, UUID ruleset, UUID source, Cause cause, UUID effective) {
        long no = store.revisions(hero).stream().filter(r -> r.rulesetId().equals(ruleset))
                .mapToLong(HeroRevisionView::revisionNo).max().orElse(0) + 1;
        UUID id = UUID.randomUUID();
        var a = actors.require();
        var entity = new com.wikiaov.hero.internal.persistence.entity.HeroRevision();
        entity.setId(id);
        entity.setHeroId(hero);
        entity.setRulesetId(ruleset);
        entity.setRevisionNo(no);
        entity.setState("DRAFT");
        entity.setVersion(1);
        entity.setCause(cause.name());
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

    private HeroRevisionView editable(UUID hero, UUID id, long expected) {
        var r = store.revision(hero, id);
        if (!r.state().equals("DRAFT"))
            throw new ApiException(HeroErrorCode.HERO_REVISION_NOT_EDITABLE, "Only drafts can be changed.");
        if (r.version() != expected)
            throw new ApiException(HeroErrorCode.HERO_REVISION_VERSION_CONFLICT, "The draft has changed.",
                    Map.of("currentVersion", r.version()));
        return r;
    }

    private void checkContext(UUID ruleset, Cause cause, UUID effective, boolean published) {
        contexts.requireRuleset(ruleset);
        if (effective == null) {
            if (cause == Cause.GAME_PATCH || cause == Cause.DATA_BASELINE)
                throw HeroValidation.invalid("Game patch revisions require a patch variant.");
            return;
        }
        var variant = contexts.variant(effective);
        if (!variant.rulesetId().equals(ruleset) || (published && !variant.published()))
            throw HeroValidation
                    .invalid("The patch variant must belong to the ruleset and be published before hero publication.");
    }

    private void bind(UUID draft, HeroSection section, UUID id) {
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

    private void bump(UUID id) {
        var entity = store.editableEntity(id);
        var actor = actors.require();
        entity.setVersion(entity.getVersion() + 1);
        entity.setUpdatedAt(clock.instant());
        entity.setUpdatedByIssuer(actor.issuer());
        entity.setUpdatedBySubject(actor.subject());
    }

    private void record(String action, UUID hero, UUID revision, Long before, Long after, String reason) {
        audit.record(new AuditEntry(actors.require(), action, "HERO", hero, revision, before, after, reason, Map.of()));
    }
}
