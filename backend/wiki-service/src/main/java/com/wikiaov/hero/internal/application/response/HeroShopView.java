package com.wikiaov.hero.internal.application.response;

import java.time.LocalDate;
import java.util.List;

/**
 * Shop facts for one market on one day: {@code price} and {@code skins} are what held then. Admin responses also carry every
 * dated step; public responses leave out the history, what still waits for review, and the editors' notes.
 */
public record HeroShopView(
        String region,
        LocalDate at,
        Price price,
        List<SkinAcquisition> skins,
        List<Price> priceHistory,
        List<SkinAcquisition> skinHistory
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
