package com.wikiaov.hero.internal.application.response;

import com.wikiaov.hero.internal.domain.HeroChanges.OverallKind;

/** The overall assessment of a hero change set and the version to send with the next change. */
public record HeroAssessmentView(
        OverallKind kind,
        long version
) {
}
