package com.wikiaov.hero.internal.importing.application;

import static com.wikiaov.hero.internal.application.response.HeroImportWarning.Code.BASELINE_IS_KNOWN_STATE;
import static com.wikiaov.hero.internal.application.response.HeroImportWarning.Code.MISSING_ROLES;
import static com.wikiaov.hero.internal.application.response.HeroImportWarning.Code.MISSING_SKILL_DESCRIPTION;
import static com.wikiaov.hero.internal.application.response.HeroImportWarning.Code.NO_EARLIER_SNAPSHOT;
import static com.wikiaov.hero.internal.application.response.HeroImportWarning.Code.NO_SNAPSHOT_TO_CORRECT;
import static com.wikiaov.hero.internal.application.response.HeroImportWarning.Code.SKILL_SOURCE_NEEDS_REVIEW;
import static com.wikiaov.hero.internal.application.response.HeroImportWarning.Code.SNAPSHOT_DIFFERENCE_UNPROVEN;
import static com.wikiaov.hero.internal.application.response.HeroImportWarning.Code.STALE_SKILL_SUMMARY;

import com.wikiaov.hero.internal.application.HeroImportRequest.Mode;
import com.wikiaov.hero.internal.application.response.HeroImportWarning;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.domain.HeroContent.Skill;
import com.wikiaov.hero.internal.domain.HeroContent.SkillTranslation;
import com.wikiaov.hero.internal.domain.HeroSkillSummaries;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.json.JsonMapper;

/** Reports publication gaps separately from the historical meaning of an import. Admin words each code. */
final class HeroImportWarnings {
    private final JsonMapper json;

    HeroImportWarnings(JsonMapper json) {
        this.json = json;
    }

    List<HeroImportWarning> forImport(Mode mode, Map<String, Object> original, Map<String, Object> normalized,
            HeroRevisionView revision, boolean missing) {
        List<HeroImportWarning> warnings = new ArrayList<>();
        if (((List<?>) normalized.get("roles")).isEmpty()) {
            warnings.add(HeroImportWarning.of(MISSING_ROLES));
        }
        addSkillReviewWarnings(original, normalized, warnings);
        addSnapshotWarnings(mode, revision, missing, warnings);
        return warnings;
    }

    private void addSkillReviewWarnings(Map<String, Object> original, Map<String, Object> normalized,
            List<HeroImportWarning> warnings) {
        Map<String, Skill> previous = new HashMap<>();
        for (var skill : json.convertValue(original.get("skills"), Skill[].class)) {
            previous.put(skill.skillKey(), skill);
        }

        for (var skill : json.convertValue(normalized.get("skills"), Skill[].class)) {
            for (var text : skill.translations()) {
                if (text.description() == null || text.description().isBlank()) {
                    warnings.add(HeroImportWarning.skill(MISSING_SKILL_DESCRIPTION, skill.skillKey(), text.locale()));
                }
                if (HeroSkillSummaries.outlivedDescription(translation(previous.get(skill.skillKey()), text.locale()),
                        text)) {
                    warnings.add(HeroImportWarning.skill(STALE_SKILL_SUMMARY, skill.skillKey(), text.locale()));
                }
            }
            if (skill.effects().stream().filter(effect -> effect.effectType().equals("SOURCE_SNAPSHOT"))
                    .anyMatch(effect -> !HeroImportContent.empty(effect.metadata().get("reviewFlags"))
                            || !HeroImportContent.empty(effect.metadata().get("review_flags")))) {
                warnings.add(HeroImportWarning.skill(SKILL_SOURCE_NEEDS_REVIEW, skill.skillKey(), null));
            }
        }
    }

    private static SkillTranslation translation(Skill skill, String locale) {
        return skill == null
                ? null
                : skill.translations().stream().filter(text -> text.locale().equals(locale)).findFirst().orElse(null);
    }

    private void addSnapshotWarnings(Mode mode, HeroRevisionView revision, boolean missing,
            List<HeroImportWarning> warnings) {
        if (missing) {
            warnings.add(HeroImportWarning.of(mode == Mode.CORRECTION ? NO_SNAPSHOT_TO_CORRECT : NO_EARLIER_SNAPSHOT));
        }
        if (mode == Mode.BASELINE) {
            warnings.add(HeroImportWarning.of(BASELINE_IS_KNOWN_STATE));
        }
        if (mode == Mode.PATCH_UPDATE && revision != null) {
            warnings.add(HeroImportWarning.of(SNAPSHOT_DIFFERENCE_UNPROVEN));
        }
    }
}
