package com.wikiaov.hero.internal.authoring.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.hero.internal.alias.persistence.IdentifierAliases;
import com.wikiaov.hero.internal.application.HeroCommands.BaselineContext;
import com.wikiaov.hero.internal.application.HeroCommands.Create;
import com.wikiaov.hero.internal.application.HeroCommands.Fork;
import com.wikiaov.hero.internal.application.HeroCommands.Mutation;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.domain.HeroContent.Bindings;
import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.Skills;
import com.wikiaov.hero.internal.domain.HeroContent.Skins;
import com.wikiaov.hero.internal.domain.HeroContent.Trait;
import com.wikiaov.hero.internal.domain.HeroEvaluations;
import com.wikiaov.hero.internal.domain.HeroImages;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.forms.application.HeroForms;
import com.wikiaov.hero.internal.forms.domain.HeroFormGameplay;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchDataReviews;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogAggregates;
import com.wikiaov.platform.RevisionState;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hero authoring use cases with their authorization, transaction and audit. {@link HeroRevisionWriter} writes the rows,
 * {@link HeroRevisionContexts} picks the patch a draft applies to and {@link HeroPublicationChecks} checks a draft
 * before it is published.
 */
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
    private final IdentifierAliases aliases;
    private final HeroForms forms;
    private final HeroRevisionWriter writer;
    private final HeroRevisionContexts revisionContexts;
    private final HeroPublicationChecks publication;

    public HeroAuthoring(PatchDataReviews dataReviews, HeroStore store, HeroSections sections,
            HeroValidation validation, GameplayContexts contexts, CurrentActor actors, AuditLog audit,
            IdentifierAliases aliases, HeroForms forms, HeroRevisionWriter writer,
            HeroRevisionContexts revisionContexts, HeroPublicationChecks publication) {
        this.dataReviews = dataReviews;
        this.store = store;
        this.sections = sections;
        this.validation = validation;
        this.contexts = contexts;
        this.actors = actors;
        this.audit = audit;
        this.aliases = aliases;
        this.forms = forms;
        this.writer = writer;
        this.revisionContexts = revisionContexts;
        this.publication = publication;
    }

    @PreAuthorize("hasAuthority('hero:write')")
    public HeroRevisionView create(Create input) {
        contexts.requireRuleset(input.rulesetId());
        var target = contexts.authoringContext(input.contextId());
        if (!target.rulesetId().equals(input.rulesetId())) {
            throw HeroValidation.invalid("The release does not belong to the selected ruleset.");
        }
        HeroValidation.locale(input.initialLocale());

        UUID id = writer.insertHero(input.code());
        UUID draft = writer.insertDraft(id, input.rulesetId(), null, Cause.DATA_BASELINE, target.patchVariantId());
        writer.createSections(id, draft, input.initialLocale(), input.name());

        record("HERO_CREATED", id, draft, null, 1L, null);

        return store.revision(id, draft);
    }

    @PreAuthorize("hasAuthority('hero:write')")
    public HeroRevisionView fork(UUID heroId, Fork input) {
        store.lockHero(heroId);
        contexts.requireRuleset(input.rulesetId());
        var draft = store.revisions(heroId).stream()
                .filter(r -> r.rulesetId().equals(input.rulesetId()) && r.state() == RevisionState.DRAFT).findFirst();
        if (draft.isPresent()) {
            throw new ApiException(HeroErrorCode.HERO_DRAFT_EXISTS, "This hero already has a draft for the ruleset.",
                    Map.of("existingDraftId", draft.get().id()));
        }
        var source = revisionContexts.forkSource(heroId, input);

        UUID id = writer.insertDraft(heroId, input.rulesetId(), source.revision().id(), input.cause(),
                source.effective());
        source.revision().sections().forEach((section, ref) -> writer.bind(id, section, ref));

        record("HERO_DRAFT_CREATED", heroId, id, null, 1L, input.changeNote());

        return store.revision(heroId, id);
    }

    @PreAuthorize("hasAuthority('hero:write')")
    public HeroRevisionView baseline(UUID heroId, UUID contextId, String locale, String name) {
        store.lockHero(heroId);
        var target = contexts.authoringContext(contextId);
        if (store.revisions(heroId).stream().anyMatch(r -> r.rulesetId().equals(target.rulesetId())
                && r.state() == RevisionState.DRAFT)) {
            throw new ApiException(HeroErrorCode.HERO_DRAFT_EXISTS, "Finish or discard the existing draft first.");
        }

        UUID draft = writer.insertDraft(heroId, target.rulesetId(), null, Cause.DATA_BASELINE, target.patchVariantId());
        writer.createSections(heroId, draft, locale, name);

        record("HERO_BASELINE_CREATED", heroId, draft, null, 1L, "Independent observed snapshot");

        return store.revision(heroId, draft);
    }

    @PreAuthorize("hasAuthority('hero:write')")
    public HeroRevisionView baselineContext(UUID heroId, UUID draftId, BaselineContext input) {
        store.lockHero(heroId);
        var draft = writer.editable(heroId, draftId, input.expectedVersion());
        var target = revisionContexts.baselineTarget(heroId, draft, input.contextId());
        if (Objects.equals(draft.effectiveFromPatchVariantId(), target.patchVariantId())) {
            return draft;
        }

        writer.observeAt(draftId, target.patchVariantId());

        record("HERO_BASELINE_CONTEXT_CHANGED", heroId, draftId, draft.version(), draft.version() + 1,
                "Observation context changed from " + draft.effectiveFromPatchVariantId() + " to "
                        + target.patchVariantId());

        return store.revision(heroId, draftId);
    }

    @PreAuthorize("hasAuthority('hero:write')")
    public HeroRevisionView update(UUID heroId, UUID draftId, HeroSection section, long expected, Object content,
            String note) {
        store.lockHero(heroId);
        var draft = writer.editable(heroId, draftId, expected);
        validation.validate(section, content);

        if (content instanceof Skins skins) {
            content = aliases.skins(heroId, skins);
        }
        if (content instanceof Bindings bindings) {
            content = aliases.bindings(bindings);
        }
        validation.validate(section, content);

        Object old = sections.content(section, draft.sections().get(section));
        content = HeroImages.retain(old, content);
        if (old instanceof Skills previous && content instanceof Skills next) {
            content = HeroEvaluations.retain(previous, next);
        }
        if (old instanceof Profile previous && content instanceof Profile next) {
            content = HeroEvaluations.retain(previous, next);
        }

        return write(heroId, draft, section, expected, old, content, note, "HERO_SECTION_UPDATED");
    }

    /** Replaces the draft's traits (ADR-029); they live in the skills section and are published with it. */
    @PreAuthorize("hasAuthority('hero:write')")
    public HeroRevisionView updateTraits(UUID heroId, UUID draftId,
            HeroEvaluationCommands.UpdateTraitsCommand command) {
        long expected = command.expectedDraftVersion();
        List<Trait> traits = command.traits();
        String note = command.changeNote();
        store.lockHero(heroId);
        var draft = writer.editable(heroId, draftId, expected);
        if (traits == null) {
            throw HeroValidation.invalid("Send the full list of traits, empty to clear them.");
        }

        var old = (Skills) sections.content(HeroSection.SKILLS, draft.sections().get(HeroSection.SKILLS));
        var content = new Skills(old.skills(), old.sources(), HeroEvaluations.normalize(traits));

        return write(heroId, draft, HeroSection.SKILLS, expected, old, content, note, "HERO_TRAITS_UPDATED");
    }

    /** Replaces the editor-written notes of one profile locale (ADR-029); blank text clears a note. */
    @PreAuthorize("hasAuthority('hero:write')")
    public HeroRevisionView updateNotes(UUID heroId, UUID draftId, HeroEvaluationCommands.UpdateNotesCommand command) {
        long expected = command.expectedDraftVersion();
        String locale = command.locale();
        String note = command.changeNote();
        store.lockHero(heroId);
        var draft = writer.editable(heroId, draftId, expected);
        HeroValidation.locale(locale);

        var old = (Profile) sections.content(HeroSection.PROFILE, draft.sections().get(HeroSection.PROFILE));
        if (old.translations().stream().noneMatch(text -> text.locale().equals(locale))) {
            throw HeroValidation.invalid("Add a profile translation for this locale before writing notes.");
        }
        var content = new Profile(old.translations().stream()
                .map(text -> text.locale().equals(locale)
                        ? text.withNotes(HeroEvaluations.note(command.strengths()),
                                HeroEvaluations.note(command.weaknesses()), HeroEvaluations.note(command.counterTips()))
                        : text)
                .toList(), old.roles(), old.positions(), old.sources());

        return write(heroId, draft, HeroSection.PROFILE, expected, old, content, note, "HERO_NOTES_UPDATED");
    }

    private HeroRevisionView write(UUID heroId, HeroRevisionView draft, HeroSection section, long expected,
            Object old, Object content, String note, String action) {
        validation.validate(section, content);
        if (forms.holdsForms(heroId) && HeroFormGameplay.present(content)) {
            throw HeroPublicationChecks.formGameplay(section);
        }
        if (Objects.equals(old, content)) {
            return draft;
        }

        writer.replaceSection(heroId, draft.id(), section, content);

        record(action, heroId, draft.id(), expected, expected + 1, note);

        return store.revision(heroId, draft.id());
    }

    @PreAuthorize("hasAuthority('hero:publish')")
    public HeroRevisionView publish(UUID heroId, UUID draftId, Mutation input) {
        store.lockHero(heroId);
        var draft = writer.editable(heroId, draftId, input.expectedVersion());

        publication.check(draft);

        writer.publish(heroId, draft);

        if (draft.cause() == Cause.DATA_BASELINE || draft.cause() == Cause.GAME_PATCH) {
            dataReviews.markDirty(draft.effectiveFromPatchVariantId());
        }

        record("HERO_PUBLISHED", heroId, draftId, input.expectedVersion(), input.expectedVersion() + 1,
                input.changeNote());

        return store.revision(heroId, draftId);
    }

    @PreAuthorize("hasAuthority('hero:write')")
    public HeroRevisionView discard(UUID heroId, UUID draftId, Mutation input) {
        store.lockHero(heroId);
        writer.editable(heroId, draftId, input.expectedVersion());

        writer.discard(draftId);

        record("HERO_DRAFT_DISCARDED", heroId, draftId, input.expectedVersion(), input.expectedVersion() + 1,
                input.changeNote());

        return store.revision(heroId, draftId);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public HeroRevisionView read(UUID heroId, UUID revisionId) {
        return store.revision(heroId, revisionId);
    }

    /** The revision with the stored content of each of its sections, read in one transaction. */
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public HeroRevisionRead readWithContent(UUID heroId, UUID revisionId) {
        return new HeroRevisionRead(store.revision(heroId, revisionId),
                HeroRevisionRead.Content.of(preview(heroId, revisionId)));
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

    private void record(String action, UUID hero, UUID revision, Long before, Long after, String reason) {
        audit.record(new AuditEntry(actors.require(), action, CatalogAggregates.HERO, hero, revision, before, after,
                reason, Map.of()));
    }
}
