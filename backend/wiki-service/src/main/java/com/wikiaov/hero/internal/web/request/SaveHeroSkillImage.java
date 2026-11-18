package com.wikiaov.hero.internal.web.request;

import com.wikiaov.hero.internal.application.HeroSkillImageCommand;
import com.wikiaov.platform.CatalogCodes;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record SaveHeroSkillImage(
        @NotNull @Min(-1) Long expectedVersion,
        @NotNull UUID assetId,
        @Size(max = 64) @Pattern(regexp = CatalogCodes.PATTERN) String skillKey,
        @NotBlank @Size(max = 255) String sourceFilename,
        @Size(max = 255) String label
) {
    public HeroSkillImageCommand command() {
        return new HeroSkillImageCommand(expectedVersion, assetId, skillKey, sourceFilename, label);
    }
}
