package com.wikiaov.hero.internal.application;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.wikiaov.platform.CatalogCodes;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Map;
import java.util.UUID;

public record HeroImportRequest(
        @NotBlank @Size(max = 64) @Pattern(regexp = CatalogCodes.PATTERN) String code,
        @NotNull UUID rulesetId,
        @JsonAlias("releaseId") @NotNull UUID contextId,
        @NotNull Mode mode,
        @NotBlank @Size(max = 16) String locale,
        @NotNull @Size(max = 20) Map<String, Object> values,
        @NotNull @Size(max = 20) Map<String, Policy> policies,
        UUID expectedRevisionId,
        Long expectedVersion
) {
    public enum Mode {
        BASELINE,
        PATCH_UPDATE,
        CORRECTION
    }

    public enum Policy {
        FILL_EMPTY,
        OVERWRITE,
        SKIP
    }
}
