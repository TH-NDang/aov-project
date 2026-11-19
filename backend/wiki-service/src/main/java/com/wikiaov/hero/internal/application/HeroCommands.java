package com.wikiaov.hero.internal.application;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.platform.CatalogCodes;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public final class HeroCommands {
    private HeroCommands() {
    }

    public record Create(
            @NotBlank @Size(max = 64) @Pattern(regexp = CatalogCodes.PATTERN) String code,
            @NotBlank @Size(max = 16) String initialLocale,
            @NotBlank @Size(max = 120) String name,
            @NotNull UUID rulesetId,
            @JsonAlias("releaseId") @NotNull UUID contextId
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

    /**
     * The complete ordered list of forms a hero holds (ADR-024). {@code expectedForms} is the list the editor last read,
     * so two editors cannot silently overwrite each other; an empty {@code forms} list turns the hero back into a hero
     * without forms.
     */
    public record ReplaceForms(
            @NotNull @Size(max = 20) List<@NotNull UUID> expectedForms,
            @NotNull @Size(max = 20) List<@NotNull @Valid FormEntry> forms,
            @Size(max = 4000) String changeNote
    ) {
    }

    public record FormEntry(
            @NotNull UUID heroId,
            @NotBlank @Size(max = 32) @Pattern(regexp = CatalogCodes.PATTERN) String formKey
    ) {
    }
}
