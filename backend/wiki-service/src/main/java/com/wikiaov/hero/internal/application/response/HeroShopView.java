package com.wikiaov.hero.internal.application.response;

import java.time.LocalDate;
import java.util.List;

/** Shop facts for one market. Public responses leave out what still waits for review, and the editors' notes. */
public record HeroShopView(
        String region,
        Price price,
        List<SkinAcquisition> skins
) {
    public record Price(
            String availability,
            Integer goldPrice,
            Integer voucherPrice,
            LocalDate capturedOn,
            Boolean needsReview,
            String note
    ) {
    }

    public record SkinAcquisition(
            String skinKey,
            String method,
            Integer voucherPrice,
            String eventName,
            LocalDate capturedOn,
            Boolean needsReview,
            String note
    ) {
    }
}
