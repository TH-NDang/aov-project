package com.wikiaov.community.currency.internal.application;

import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param sourceUrl
 *            base URL of the rate source
 * @param historyStart
 *            the oldest day to keep; prizes older than this show their original amount
 * @param currencies
 *            ISO codes to keep, without the US dollar, which is the base
 */
@ConfigurationProperties("community.exchange-rates")
public record ExchangeRateSettings(
        String sourceUrl,
        LocalDate historyStart,
        List<String> currencies
) {
    public ExchangeRateSettings {
        if (sourceUrl == null || sourceUrl.isBlank() || historyStart == null || currencies == null
                || currencies.isEmpty())
            throw new IllegalArgumentException("Exchange rates need a source URL, a start date and currencies.");
        if (!currencies.stream().allMatch(code -> code.matches("[A-Z]{3}") && !code.equals("USD")))
            throw new IllegalArgumentException("Exchange rate currencies must be ISO codes other than USD.");
        currencies = List.copyOf(currencies);
    }
}
