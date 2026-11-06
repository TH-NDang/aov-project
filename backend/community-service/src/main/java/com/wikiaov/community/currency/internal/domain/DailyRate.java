package com.wikiaov.community.currency.internal.domain;

import java.math.BigDecimal;
import java.time.LocalDate;

/** How many units of a currency one US dollar bought on a day. */
public record DailyRate(
        String currency,
        LocalDate date,
        BigDecimal unitsPerUsd
) {
}
