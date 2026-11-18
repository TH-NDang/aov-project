package com.wikiaov.hero.internal.application;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public final class HeroShopCommands {
    private HeroShopCommands() {
    }

    public record SavePrice(
            @NotBlank String availability,
            @PositiveOrZero @Max(10000000) Integer goldPrice,
            @PositiveOrZero @Max(10000000) Integer voucherPrice,
            LocalDate capturedOn,
            Boolean needsReview,
            @Size(max = 500) String note
    ) {
    }

    public record SaveSkinAcquisition(
            @NotBlank String method,
            @PositiveOrZero @Max(10000000) Integer voucherPrice,
            @Size(max = 200) String eventName,
            LocalDate capturedOn,
            Boolean needsReview,
            @Size(max = 500) String note
    ) {
    }
}
