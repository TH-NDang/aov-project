package com.wikiaov.hero.internal.application;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record HeroImportJobRequest(
        @NotNull UUID id,
        @NotNull @Size(min = 1, max = 200) List<@NotNull @Valid HeroImportRequest> rows
) {
}
