package com.wikiaov.spell.internal.application;
import com.wikiaov.spell.internal.domain.SpellContent;
import jakarta.validation.constraints.*;
import java.util.UUID;
public final class SpellCommands {
    private SpellCommands() {
    }
    public record Create(
            @NotBlank @Size(max = 120) @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String code,
            @NotNull UUID rulesetId,
            UUID effectiveFromPatchVariantId,
            @NotBlank @Size(max = 16) String initialLocale,
            @NotBlank @Size(max = 255) String name,
            SpellContent content
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
            @NotNull SpellContent content,
            @Size(max = 4000) String changeNote,
            UUID effectiveFromPatchVariantId,
            Boolean clearPatchContext
    ) {
    }
    public record Mutation(
            @NotNull @Positive Long expectedVersion,
            @Size(max = 4000) String changeNote
    ) {
    }
    public record Removal(
            @NotNull UUID revisionId,
            @NotNull UUID patchVariantId,
            @NotBlank @Size(max = 2048) String sourceUrl,
            @Size(max = 4000) String notes
    ) {
    }
}
