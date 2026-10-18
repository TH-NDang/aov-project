package com.wikiaov.hero.internal.application;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public final class SkinBadgeGroupCommands {
    private SkinBadgeGroupCommands() {
    }

    public record Translation(
            @NotBlank @Size(max = 16) String locale,
            @NotBlank @Size(max = 255) String displayName
    ) {
    }

    public record Create(
            @NotBlank @Size(max = 64) @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String code,
            @NotNull @Pattern(regexp = "RANK|THEME") String kind,
            @NotNull @Size(max = 30) List<@NotNull @Valid Translation> translations
    ) {
    }

    public record Update(
            @NotNull @PositiveOrZero Long expectedVersion,
            @NotNull @Pattern(regexp = "RANK|THEME") String kind,
            @NotNull @Size(max = 30) List<@NotNull @Valid Translation> translations
    ) {
    }
}
