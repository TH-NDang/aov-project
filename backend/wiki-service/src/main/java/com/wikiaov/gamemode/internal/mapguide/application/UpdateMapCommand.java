package com.wikiaov.gamemode.internal.mapguide.application;

import com.wikiaov.gamemode.internal.domain.MapGuideContent;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/** Replaces the content of an open map draft whose version is still {@code expectedVersion}. */
public record UpdateMapCommand(
        @NotNull @Positive Long expectedVersion,
        @NotNull MapGuideContent content,
        @Size(max = 4000) String changeNote
) {
}
