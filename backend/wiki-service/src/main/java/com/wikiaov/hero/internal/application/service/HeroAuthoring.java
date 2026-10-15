package com.wikiaov.hero.internal.application.service;
import com.wikiaov.access.*;
import com.wikiaov.hero.internal.application.*;
import com.wikiaov.hero.internal.application.HeroCommands.*;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.persistence.*;
import com.wikiaov.patch.GameplayContexts;
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
    private final HeroStore store;
    private final HeroSections sections;
    private final HeroValidation validation;
    private final GameplayContexts contexts;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;
    public HeroAuthoring(HeroStore store, HeroSections sections, HeroValidation validation, GameplayContexts contexts,
            CurrentActor actors, AuditLog audit, Clock clock) {
        this.store = store;
        this.sections = sections;
        this.validation = validation;
        this.contexts = contexts;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }
    @PreAuthorize("hasAuthority('hero:write')")
    public HeroRevisionView create(Create input) {
        contexts.requireRuleset(input.rulesetId());
        HeroValidation.locale(input.initialLocale());
        var actor = actors.require();
        UUID id = UUID.randomUUID();
        try {
            store.write("INSERT INTO hero.hero VALUES(?,?,?,?,?)", id, input.code(), HeroStore.time(clock.instant()),
                    actor.issuer(), actor.subject());
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(HeroErrorCode.HERO_CODE_EXISTS, "The hero code is already in use.");
        }
        UUID draft = insertDraft(id, input.rulesetId(), null, Cause.OTHER, null);
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
        if (input.cause() != Cause.GAME_PATCH && !Objects.equals(effective, source.effectiveFromPatchVariantId()))
            throw HeroValidation.invalid("Content corrections must retain source gameplay applicability.");
        UUID id = insertDraft(heroId, input.rulesetId(), source.id(), input.cause(), effective);
        source.sections().forEach((s, ref) -> bind(id, s, ref));
        record("HERO_DRAFT_CREATED", heroId, id, null, 1L, input.changeNote());
        return store.revision(heroId, id);
    }
    @PreAuthorize("hasAuthority('hero:write')")
    public HeroRevisionView update(UUID heroId, UUID draftId, HeroSection section, long expected, Object content,
            String note) {
        store.lockHero(heroId);
        var draft = editable(heroId, draftId, expected);
        validation.validate(section, content);
        Object old = sections.content(section, draft.sections().get(section));
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
            validation.validate(section, sections.content(section, draft.sections().get(section)));
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
        store.write(
                "UPDATE hero.hero_revision SET state='PUBLISHED',publication_sequence=?,published_at=?,version=version+1,updated_at=?,updated_by_issuer=?,updated_by_subject=? WHERE id=?",
                seq, HeroStore.time(clock.instant()), HeroStore.time(clock.instant()), actors.require().issuer(),
                actors.require().subject(), draftId);
        record("HERO_PUBLISHED", heroId, draftId, input.expectedVersion(), input.expectedVersion() + 1,
                input.changeNote());
        return store.revision(heroId, draftId);
    }
    @PreAuthorize("hasAuthority('hero:write')")
    public HeroRevisionView discard(UUID heroId, UUID draftId, Mutation input) {
        store.lockHero(heroId);
        editable(heroId, draftId, input.expectedVersion());
        bump(draftId);
        store.write("UPDATE hero.hero_revision SET state='DISCARDED' WHERE id=?", draftId);
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
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public com.wikiaov.platform.PageSlice<Map<String, Object>> list(int page, int size) {
        if (page < 0 || size < 1 || size > 100)
            throw HeroValidation.invalid("Invalid page bounds.");
        var rows = store.rows("SELECT id,code,created_at FROM hero.hero ORDER BY code LIMIT ? OFFSET ?", size,
                (long) page * size);
        var items = rows.stream().map(row -> {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", row.get("id"));
            result.put("code", row.get("code"));
            result.put("revisions", store.revisions((UUID) row.get("id")));
            return result;
        }).toList();
        long count = ((Number) store.rows("SELECT count(*) n FROM hero.hero").getFirst().get("n")).longValue();
        return new com.wikiaov.platform.PageSlice<>(items, page, size, count);
    }
    private UUID insertDraft(UUID hero, UUID ruleset, UUID source, Cause cause, UUID effective) {
        long no = store.revisions(hero).stream().filter(r -> r.rulesetId().equals(ruleset))
                .mapToLong(HeroRevisionView::revisionNo).max().orElse(0) + 1;
        UUID id = UUID.randomUUID();
        var a = actors.require();
        var at = HeroStore.time(clock.instant());
        store.write(
                "INSERT INTO hero.hero_revision(id,hero_id,ruleset_id,revision_no,state,version,cause,source_revision_id,effective_from_patch_variant_id,created_at,updated_at,created_by_issuer,created_by_subject,updated_by_issuer,updated_by_subject) VALUES(?,?,?,?,'DRAFT',1,?,?,?,?,?,?,?,?,?)",
                id, hero, ruleset, no, cause.name(), source, effective, at, at, a.issuer(), a.subject(), a.issuer(),
                a.subject());
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
            if (cause == Cause.GAME_PATCH)
                throw HeroValidation.invalid("Game patch revisions require a patch variant.");
            return;
        }
        var variant = contexts.variant(effective);
        if (!variant.rulesetId().equals(ruleset) || (published && !variant.published()))
            throw HeroValidation
                    .invalid("The patch variant must belong to the ruleset and be published before hero publication.");
    }
    private void bind(UUID draft, HeroSection section, UUID id) {
        store.write("UPDATE hero.hero_revision SET " + section.column() + "=? WHERE id=?", id, draft);
    }
    private void bump(UUID id) {
        var a = actors.require();
        store.write(
                "UPDATE hero.hero_revision SET version=version+1,updated_at=?,updated_by_issuer=?,updated_by_subject=? WHERE id=?",
                HeroStore.time(clock.instant()), a.issuer(), a.subject(), id);
    }
    private void record(String action, UUID hero, UUID revision, Long before, Long after, String reason) {
        audit.record(new AuditEntry(actors.require(), action, "HERO", hero, revision, before, after, reason, Map.of()));
    }
}
