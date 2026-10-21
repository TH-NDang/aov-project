package com.wikiaov.hero.internal.application;

import java.util.UUID;

public record HeroSkillImageCommand(
        long expectedVersion,
        UUID assetId,
        String skillKey,
        String sourceFilename,
        String label
) {
}
