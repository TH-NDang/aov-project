package com.wikiaov.hero.internal.forms.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.hero.internal.application.HeroCommands.ReplaceForms;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.response.HeroFormsView;
import com.wikiaov.hero.internal.application.response.HeroPublishReadinessView.Name;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.forms.domain.HeroFormGameplay;
import com.wikiaov.hero.internal.forms.domain.HeroFormStructure;
import com.wikiaov.hero.internal.forms.domain.HeroFormStructure.Form;
import com.wikiaov.hero.internal.forms.persistence.HeroFormRepository;
import com.wikiaov.hero.internal.forms.persistence.entity.HeroFormMembership;
import com.wikiaov.hero.internal.profile.persistence.HeroProfileSnapshots;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogAggregates;
import com.wikiaov.platform.RevisionState;
import java.time.Clock;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Which heroes hold forms, in which order, and the editors' switcher between them (ADR-024). */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class HeroForms {
    private static final Set<HeroSection> GAMEPLAY = EnumSet.of(HeroSection.PROFILE, HeroSection.OVERVIEW_RATINGS,
            HeroSection.COMBAT_STATS, HeroSection.SKILLS);

    private final HeroFormRepository forms;
    private final HeroStore store;
    private final HeroSections sections;
    private final HeroProfileSnapshots profiles;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    /** The whole structure for read models. It is a handful of rows and carries no unpublished content. */
    public HeroFormStructure structure() {
        return new HeroFormStructure(forms.findAllByOrderByParentHeroIdAscDisplayOrderAsc().stream()
                .map(HeroForms::form).toList());
    }

    public boolean holdsForms(UUID heroId) {
        return forms.existsByParentHeroId(heroId);
    }

    /** The hero codes a filter by {@code code} covers: the code itself and, for a hero that holds forms, every form. */
    public Set<String> codesFor(String code) {
        var members = store.findByCode(code).map(hero -> structure().formsOf(hero.getId())).orElse(List.of());
        if (members.isEmpty())
            return Set.of(code);

        Set<String> codes = new HashSet<>();
        codes.add(code);
        store.heroes(members.stream().map(Form::heroId).toList()).forEach(form -> codes.add(form.getCode()));
        return codes;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public HeroFormsView view(UUID heroId) {
        var hero = store.requireHero(heroId);
        var structure = structure();
        UUID holderId = structure.holdsForms(heroId)
                ? heroId
                : structure.form(heroId).map(Form::holderId).orElse(null);
        if (holderId == null)
            return new HeroFormsView(heroId, hero.getCode(), null, null, List.of());

        var members = structure.formsOf(holderId);
        var ids = Stream.concat(Stream.of(holderId), members.stream().map(Form::heroId)).toList();
        var codes = store.heroes(ids).stream().collect(Collectors.toMap(HeroIdentity::getId, HeroIdentity::getCode));
        var revisions = store.revisions(ids).stream().filter(revision -> revision.state() != RevisionState.DISCARDED)
                .collect(Collectors.groupingBy(HeroRevisionView::heroId));
        var newestProfiles = profiles.contents(revisions.values().stream()
                .map(rows -> rows.getFirst().sections().get(HeroSection.PROFILE)).filter(Objects::nonNull).toList());
        Function<UUID, Optional<Profile>> profile = id -> Optional.ofNullable(revisions.get(id))
                .map(rows -> newestProfiles.get(rows.getFirst().sections().get(HeroSection.PROFILE)));

        var holder = new HeroFormsView.Holder(holderId, codes.get(holderId), names(profile.apply(holderId)));
        var entries = members.stream().map(form -> {
            var rows = revisions.getOrDefault(form.heroId(), List.of());
            return new HeroFormsView.Form(form.heroId(), codes.get(form.heroId()), form.formKey(),
                    form.displayOrder(), names(profile.apply(form.heroId())),
                    profile.apply(form.heroId()).map(Profile::roles).orElse(Set.of()),
                    rows.stream().anyMatch(row -> row.state() == RevisionState.PUBLISHED),
                    rows.stream().anyMatch(row -> row.state() == RevisionState.DRAFT));
        }).toList();

        return new HeroFormsView(heroId, hero.getCode(), holder,
                structure.form(heroId).map(Form::formKey).orElse(null), entries);
    }

    @PreAuthorize("hasAuthority('hero:publish')")
    @Transactional
    public HeroFormsView replace(UUID holderId, ReplaceForms input) {
        store.lockHero(holderId);
        var holder = store.requireHero(holderId);
        var structure = structure();
        if (structure.isForm(holderId))
            throw HeroValidation.invalid("A form cannot hold forms.");
        var current = structure.formsOf(holderId).stream().map(Form::heroId).toList();
        if (!current.equals(input.expectedForms()))
            throw new ApiException(HeroErrorCode.HERO_FORMS_CONFLICT, "The hero's forms have changed.",
                    Map.of("currentForms", current));

        validateEntries(holder, input, structure);
        if (!input.forms().isEmpty())
            requireNoGameplay(holderId);

        var previous = forms.findByParentHeroIdOrderByDisplayOrderAsc(holderId).stream()
                .collect(Collectors.toMap(HeroFormMembership::getHeroId, Function.identity()));
        var actor = actors.require();
        forms.deleteByParentHeroId(holderId);
        List<HeroFormMembership> rows = new ArrayList<>();
        for (int i = 0; i < input.forms().size(); i++) {
            var entry = input.forms().get(i);
            var kept = previous.get(entry.heroId());
            var row = new HeroFormMembership();
            row.setHeroId(entry.heroId());
            row.setParentHeroId(holderId);
            row.setFormKey(entry.formKey());
            row.setDisplayOrder(i + 1);
            row.setCreatedAt(kept == null ? clock.instant() : kept.getCreatedAt());
            row.setCreatedByIssuer(kept == null ? actor.issuer() : kept.getCreatedByIssuer());
            row.setCreatedBySubject(kept == null ? actor.subject() : kept.getCreatedBySubject());
            rows.add(row);
        }
        try {
            forms.saveAllAndFlush(rows);
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(HeroErrorCode.HERO_FORMS_CONFLICT, "Another change to these forms was saved.");
        }

        audit.record(new AuditEntry(actor, "HERO_FORMS_UPDATED", CatalogAggregates.HERO, holderId, null, null, null,
                input.changeNote(), Map.of("before", current, "after",
                        input.forms().stream().map(entry -> entry.formKey() + ":" + entry.heroId()).toList())));

        return view(holderId);
    }

    private void validateEntries(HeroIdentity holder, ReplaceForms input, HeroFormStructure structure) {
        var ids = input.forms().stream().map(entry -> entry.heroId()).toList();
        if (new HashSet<>(ids).size() != ids.size()
                || input.forms().stream().map(entry -> entry.formKey()).distinct().count() != ids.size())
            throw HeroValidation.invalid("Each form appears once and has its own key.");

        var codes = store.heroes(ids).stream().collect(Collectors.toMap(HeroIdentity::getId, HeroIdentity::getCode));
        for (var entry : input.forms()) {
            if (!codes.containsKey(entry.heroId()))
                throw new ApiException(HeroErrorCode.HERO_NOT_FOUND, "A form hero does not exist.",
                        Map.of("heroId", entry.heroId()));
            if (entry.heroId().equals(holder.getId()) || structure.holdsForms(entry.heroId()))
                throw HeroValidation.invalid("A hero that holds forms cannot be a form.");
            var owner = structure.form(entry.heroId()).map(Form::holderId);
            if (owner.isPresent() && !owner.get().equals(holder.getId()))
                throw HeroValidation.invalid("The hero is already a form of another hero.");
            if (!codes.get(entry.heroId()).equals(holder.getCode() + "-" + entry.formKey()))
                throw HeroValidation.invalid("A form's code must be the hero code followed by the form key.");
        }
    }

    private void requireNoGameplay(UUID holderId) {
        for (var revision : store.revisions(holderId)) {
            if (revision.state() == RevisionState.DISCARDED)
                continue;
            for (var section : GAMEPLAY) {
                UUID id = revision.sections().get(section);
                if (id != null && HeroFormGameplay.present(sections.content(section, id)))
                    throw new ApiException(HeroErrorCode.HERO_FORM_PARENT_GAMEPLAY,
                            "Move roles, positions, ratings, stats and skills to the forms before adding forms.",
                            Map.of("revisionId", revision.id(), "section", section.name()));
            }
        }
    }

    private static List<Name> names(Optional<Profile> profile) {
        return profile.map(value -> value.translations().stream().map(t -> new Name(t.locale(), t.name())).toList())
                .orElse(List.of());
    }

    private static Form form(HeroFormMembership row) {
        return new Form(row.getHeroId(), row.getParentHeroId(), row.getFormKey(), row.getDisplayOrder());
    }
}
