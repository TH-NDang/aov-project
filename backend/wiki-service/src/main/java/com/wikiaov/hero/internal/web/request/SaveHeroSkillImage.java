package com.wikiaov.hero.internal.web.request;

import com.wikiaov.hero.internal.application.HeroSkillImageCommand;
import jakarta.validation.constraints.*;
import java.util.UUID;

public record SaveHeroSkillImage(
        @NotNull @Min(-1) Long expectedVersion,
        @NotNull UUID assetId,
        @Size(max = 64) @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String skillKey,
        @NotBlank @Size(max = 255) String sourceFilename,
        @Size(max = 255) String label
) {
    public HeroSkillImageCommand command() {
        return new HeroSkillImageCommand(expectedVersion, assetId, skillKey, sourceFilename, label);
    }
}
