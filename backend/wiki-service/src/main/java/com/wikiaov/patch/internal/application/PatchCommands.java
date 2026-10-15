package com.wikiaov.patch.internal.application;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
public final class PatchCommands {
    private PatchCommands() {
    }
    public record Ruleset(
            @NotBlank @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9-]{0,63}") String code,
            @NotNull @Size(max = 4000) String description
    ) {
    }
    public record Assignment(
            @NotNull UUID rulesetId,
            @NotNull Instant validFrom,
            Instant validTo
    ) {
    }
    public record Translation(
            @NotBlank @Size(max = 16) String locale,
            @NotBlank @Size(max = 200) String title,
            @NotNull @Size(max = 20000) String summary,
            @Size(max = 100000) String description
    ) {
    }
    public record Patch(
            @NotBlank @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") @Size(max = 64) String code,
            @NotEmpty @Size(max = 30) List<@Valid Translation> translations
    ) {
    }
    public record Variant(
            @NotNull UUID rulesetId,
            @NotBlank @Size(max = 64) String variantCode,
            @Positive long rulesetOrdinal
    ) {
    }
    public record Release(
            @NotNull UUID regionId,
            @NotNull Instant effectiveAt,
            Instant announcedAt,
            @Size(max = 2000) String sourceUrl
    ) {
    }
}
