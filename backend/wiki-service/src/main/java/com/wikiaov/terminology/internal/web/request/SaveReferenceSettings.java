package com.wikiaov.terminology.internal.web.request;

import com.wikiaov.terminology.internal.domain.ReferenceSettings;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record SaveReferenceSettings(
        @Min(1) long expectedVersion,
        @NotNull ReferenceSettings settings
) {
}
