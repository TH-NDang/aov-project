package com.wikiaov.hero.internal.application;

import jakarta.validation.constraints.*;
import java.util.Map;
import java.util.UUID;

public record HeroImportRequest(
        @NotBlank @Size(max = 64) @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String code,
        @NotNull UUID rulesetId,
        @com.fasterxml.jackson.annotation.JsonAlias("releaseId") @NotNull UUID contextId,
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
