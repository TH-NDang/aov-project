package com.wikiaov.hero.internal.application;

import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;

public final class HeroCommands {
    private HeroCommands() {
    }

    public record Create(
            @NotBlank @Size(max = 64) @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String code,
            @NotBlank @Size(max = 16) String initialLocale,
            @NotBlank @Size(max = 120) String name,
            @NotNull UUID rulesetId,
            @com.fasterxml.jackson.annotation.JsonAlias("releaseId") @NotNull UUID contextId
    ) {
    }

    public record Fork(
            @NotNull UUID rulesetId,
            UUID sourceRevisionId,
            @NotNull Cause cause,
            UUID effectiveFromPatchVariantId,
            @Size(max = 4000) String changeNote
    ) {
    }

    public record Mutation(
            @NotNull @Positive Long expectedVersion,
            @Size(max = 4000) String changeNote
    ) {
    }

    public record BaselineContext(
            @NotNull @Positive Long expectedVersion,
            @NotNull UUID contextId
    ) {
    }

    public record SectionUpdate<T>(
            @NotNull @Positive Long expectedDraftVersion,
            @NotNull @Valid T content,
            @Size(max = 4000) String changeNote
    ) {
    }
}
