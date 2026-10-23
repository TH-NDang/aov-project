package com.wikiaov.arcana.internal.application;

import com.wikiaov.arcana.internal.domain.ArcanaContent;
import jakarta.validation.constraints.*;
import java.util.UUID;

public final class ArcanaCommands {
    private ArcanaCommands() {
    }

    public record Create(
            @NotBlank @Size(max = 120) @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String code,
            @NotNull UUID rulesetId,
            UUID effectiveFromPatchVariantId,
            @NotBlank @Size(max = 16) String initialLocale,
            @NotBlank @Size(max = 255) String name,
            ArcanaContent content
    ) {
    }

    public record Fork(
            @NotNull UUID rulesetId,
            @NotNull UUID sourceRevisionId,
            @NotBlank String cause,
            UUID effectiveFromPatchVariantId,
            @Size(max = 4000) String changeNote
    ) {
    }

    public record Update(
            @NotNull @Positive Long expectedVersion,
            @NotNull ArcanaContent content,
            @Size(max = 4000) String changeNote,
            UUID effectiveFromPatchVariantId
    ) {
    }

    public record Mutation(
            @NotNull @Positive Long expectedVersion,
            @Size(max = 4000) String changeNote
    ) {
    }
}
