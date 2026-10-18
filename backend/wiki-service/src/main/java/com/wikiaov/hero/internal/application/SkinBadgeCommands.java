package com.wikiaov.hero.internal.application;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.UUID;

public final class SkinBadgeCommands {
    private SkinBadgeCommands() {
    }

    public record Translation(
            @NotBlank @Size(max = 16) String locale,
            @NotBlank @Size(max = 255) String displayName,
            UUID iconAssetId
    ) {
    }

    public record Create(
            @Size(max = 64) @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String code,
            @NotNull @Pattern(regexp = "UNKNOWN|RARITY|EVENT") String kind,
            @NotNull @Size(max = 30) List<@NotNull @Valid Translation> translations,
            UUID groupId,
            @Size(max = 12) @Pattern(regexp = "[a-z]{2}|global") String regionCode
    ) {
        public Create(String code, String kind, List<Translation> translations) {
            this(code, kind, translations, null, null);
        }

        public Create(String code, String kind, List<Translation> translations, UUID groupId) {
            this(code, kind, translations, groupId, null);
        }
    }

    public record Update(
            @NotNull @PositiveOrZero Long expectedVersion,
            @NotNull @Pattern(regexp = "UNKNOWN|RARITY|EVENT") String kind,
            @NotNull @Size(max = 30) List<@NotNull @Valid Translation> translations
    ) {
    }

    public record AssignGroup(
            @NotNull @PositiveOrZero Long expectedVersion,
            @JsonProperty(required = true) UUID groupId
    ) {
    }
}
