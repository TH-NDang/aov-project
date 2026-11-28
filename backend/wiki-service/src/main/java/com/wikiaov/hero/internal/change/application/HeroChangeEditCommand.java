package com.wikiaov.hero.internal.change.application;

import com.wikiaov.hero.internal.domain.HeroChanges.Change;
import com.wikiaov.hero.internal.domain.HeroChanges.Summary;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * What an editor rewrites in a recorded hero change set: the source link, the summaries of the listed locales (others
 * stay) and the full list of lines, with the same limits as recording one.
 */
public record HeroChangeEditCommand(
        @Size(max = 2048) String sourceUrl,
        @NotEmpty @Size(max = 30) List<@Valid Summary> summaryTranslations,
        @NotEmpty @Size(max = 200) List<@Valid Change> changes
) {
}
