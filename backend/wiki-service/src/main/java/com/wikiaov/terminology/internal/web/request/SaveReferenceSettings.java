package com.wikiaov.terminology.internal.web.request;
import com.wikiaov.terminology.internal.domain.ReferenceSettings;
import jakarta.validation.constraints.*;
public record SaveReferenceSettings(
        @Min(1) long expectedVersion,
        @NotNull ReferenceSettings settings
) {
}
