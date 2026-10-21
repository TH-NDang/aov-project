package com.wikiaov.hero.internal.application.service;

import com.wikiaov.hero.internal.application.HeroImportRequest;
import com.wikiaov.hero.internal.application.response.HeroImportPlan;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import java.util.*;
import tools.jackson.databind.json.JsonMapper;

/** Applies changed sections in order, carrying the current draft version between writes. */
final class HeroImportDraftWriter {
    private final HeroAuthoring authoring;
    private final HeroImportRevisions revisions;
    private final HeroImportContent content;
    private final JsonMapper json;

    HeroImportDraftWriter(HeroAuthoring authoring, HeroImportRevisions revisions, HeroImportContent content,
            JsonMapper json) {
        this.authoring = authoring;
        this.revisions = revisions;
        this.content = content;
        this.json = json;
    }

    void apply(HeroImportRequest input, HeroImportPlan plan) {
        var draft = revisions.openDraft(input, plan);
        var existing = authoring.preview(draft.heroId(), draft.id());
        draft = updateProfile(input.locale(), plan, draft, (Profile) existing.get(HeroSection.PROFILE));
        draft = updateStatistics(plan, draft);
        draft = updateSkills(plan, draft, existing);
        draft = updateSkins(plan, draft, existing);
        updateImages(plan, draft, (Bindings) existing.get(HeroSection.MEDIA_BINDINGS));
    }

    private HeroRevisionView updateProfile(String locale, HeroImportPlan plan, HeroRevisionView draft,
            Profile existing) {
        var next = content.profile(locale, plan.after(), existing);
        if (Objects.equals(existing, next))
            return draft;
        return authoring.update(draft.heroId(), draft.id(), HeroSection.PROFILE, draft.version(), next,
                "Imported hero fields");
    }

    private HeroRevisionView updateStatistics(HeroImportPlan plan, HeroRevisionView draft) {
        for (var field : Map.of("overviewRatings", HeroSection.OVERVIEW_RATINGS,
                "combatStats", HeroSection.COMBAT_STATS).entrySet()) {
            Object value = plan.after().get(field.getKey());
            if (value != null && changed(plan, field.getKey())) {
                Object statisticContent = field.getValue() == HeroSection.OVERVIEW_RATINGS
                        ? json.convertValue(value, Ratings.class)
                        : json.convertValue(value, Stats.class);
                draft = authoring.update(draft.heroId(), draft.id(), field.getValue(), draft.version(),
                        statisticContent, "Imported hero statistics");
            }
        }
        return draft;
    }

    private HeroRevisionView updateSkills(HeroImportPlan plan, HeroRevisionView draft,
            Map<HeroSection, Object> sections) {
        if (!changed(plan, "skills"))
            return draft;
        var existing = (Skills) sections.get(HeroSection.SKILLS);
        var skills = Arrays.asList(json.convertValue(plan.after().get("skills"), Skill[].class));
        return authoring.update(draft.heroId(), draft.id(), HeroSection.SKILLS, draft.version(),
                new Skills(skills, existing == null ? List.of() : existing.sources()), "Imported skills");
    }

    private HeroRevisionView updateSkins(HeroImportPlan plan, HeroRevisionView draft,
            Map<HeroSection, Object> sections) {
        if (!changed(plan, "skins"))
            return draft;
        var existing = (Skins) sections.get(HeroSection.SKINS);
        var skins = Arrays.asList(json.convertValue(plan.after().get("skins"), Skin[].class));
        return authoring.update(draft.heroId(), draft.id(), HeroSection.SKINS, draft.version(),
                new Skins(skins, existing == null ? List.of() : existing.sources()), "Imported skins");
    }

    private void updateImages(HeroImportPlan plan, HeroRevisionView draft, Bindings existing) {
        Map<MediaRole, UUID> links = new EnumMap<>(MediaRole.class);
        if (existing != null)
            links.putAll(existing.bindings());
        boolean mediaChanged = changed(plan, "images");
        for (var role : MediaRole.values()) {
            String key = role.name().toLowerCase(Locale.ROOT);
            if (changed(plan, key)) {
                links.put(role, UUID.fromString((String) plan.after().get(key)));
                mediaChanged = true;
            }
        }
        if (!mediaChanged)
            return;
        draft = authoring.read(draft.heroId(), draft.id());
        authoring.update(draft.heroId(), draft.id(), HeroSection.MEDIA_BINDINGS, draft.version(),
                new Bindings(links, existing == null ? List.of() : existing.sources(),
                        content.imageOptions(plan.after().get("images"))),
                "Imported hero images");
    }

    private static boolean changed(HeroImportPlan plan, String field) {
        return !Objects.equals(plan.before().get(field), plan.after().get(field));
    }
}
