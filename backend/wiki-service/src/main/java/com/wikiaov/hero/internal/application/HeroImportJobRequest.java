package com.wikiaov.hero.internal.application;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;

public record HeroImportJobRequest(
        @NotNull UUID id,
        @NotNull @Size(min = 1, max = 200) List<@NotNull @Valid HeroImportRequest> rows
) {
}
