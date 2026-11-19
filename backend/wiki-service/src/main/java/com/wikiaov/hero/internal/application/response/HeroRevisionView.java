package com.wikiaov.hero.internal.application.response;

import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.platform.RevisionState;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record HeroRevisionView(
        UUID id,
        UUID heroId,
        UUID rulesetId,
        long revisionNo,
        RevisionState state,
        long version,
        Long publicationSequence,
        Instant publishedAt,
        Cause cause,
        UUID sourceRevisionId,
        UUID effectiveFromPatchVariantId,
        Map<HeroSection, UUID> sections
) {
}
