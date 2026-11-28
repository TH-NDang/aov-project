package com.wikiaov.community.community.internal.translation.application;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * How Stream posts are translated with the Claude API (ADR-037).
 *
 * @param apiKey
 *            key of the Claude API, set in the environment only; without one, translation is off
 * @param model
 *            the model; the owner chose Claude Haiku 5.5 on 2026-11-28
 * @param effort
 *            the model's effort, {@code low} to {@code max}
 * @param maxOutputTokens
 *            the answer's limit, thinking included
 * @param timeout
 *            how long one call to the API may take
 * @param locales
 *            the languages posts are translated into
 * @param glossaryLocales
 *            the languages whose game names are read from wiki-service, sources and targets alike
 * @param region
 *            the market whose catalog names the glossary uses
 * @param glossaryTtl
 *            how long the glossary is kept before it is checked again
 * @param imageHosts
 *            hosts the service downloads post images from; images elsewhere are not read
 * @param maxImages
 *            images read per post, in order
 * @param maxImageBytes
 *            the largest image sent; the API takes up to 5 MB
 * @param hourlyPerRequester
 *            new translations one account or address may start in an hour
 * @param monthlyBudgetUsd
 *            what the service may spend in a calendar month (UTC); translation stops for the month when it is reached
 * @param inputUsdPerMillion
 *            price of a million input tokens, for the budget
 * @param outputUsdPerMillion
 *            price of a million output tokens, for the budget
 */
@ConfigurationProperties("community.translation")
public record TranslationSettings(
        @Nullable String apiKey,
        String model,
        String effort,
        int maxOutputTokens,
        Duration timeout,
        List<String> locales,
        List<String> glossaryLocales,
        String region,
        Duration glossaryTtl,
        List<String> imageHosts,
        int maxImages,
        int maxImageBytes,
        int hourlyPerRequester,
        BigDecimal monthlyBudgetUsd,
        BigDecimal inputUsdPerMillion,
        BigDecimal outputUsdPerMillion
) {
    private static final List<String> EFFORTS = List.of("low", "medium", "high", "xhigh", "max");
    private static final List<String> TARGETS = List.of("vi-VN", "en-US", "th-TH", "zh-TW", "id-ID");

    public TranslationSettings {
        apiKey = apiKey == null || apiKey.isBlank() ? null : apiKey.strip();
        if (model == null || model.isBlank() || !EFFORTS.contains(effort) || maxOutputTokens < 1024
                || timeout == null || timeout.isNegative() || timeout.isZero()) {
            throw new IllegalArgumentException("Translation needs a model, an effort, a token limit and a timeout.");
        }
        locales = locales == null ? List.of() : List.copyOf(locales);
        glossaryLocales = glossaryLocales == null ? List.of() : List.copyOf(glossaryLocales);
        imageHosts = imageHosts == null
                ? List.of()
                : imageHosts.stream().map(String::strip)
                        .filter(host -> !host.isBlank()).toList();
        if (locales.isEmpty() || !TARGETS.containsAll(locales) || !glossaryLocales.containsAll(locales)) {
            throw new IllegalArgumentException("Translate into known languages that the glossary also reads.");
        }
        if (region == null || region.isBlank() || glossaryTtl == null || glossaryTtl.isNegative()) {
            throw new IllegalArgumentException("The glossary needs a region and a lifetime.");
        }
        if (maxImages < 0 || maxImageBytes < 1 || maxImageBytes > 5 * 1024 * 1024 || hourlyPerRequester < 0) {
            throw new IllegalArgumentException("Image and request limits must fit the API.");
        }
        if (monthlyBudgetUsd == null || monthlyBudgetUsd.signum() < 0 || inputUsdPerMillion == null
                || inputUsdPerMillion.signum() < 0 || outputUsdPerMillion == null
                || outputUsdPerMillion.signum() < 0) {
            throw new IllegalArgumentException("Budget and prices must not be negative.");
        }
    }

    public boolean enabled() {
        return apiKey != null;
    }

    /** What a call cost, in millionths of a dollar. */
    public long costMicros(long inputTokens, long outputTokens) {
        return inputUsdPerMillion.multiply(BigDecimal.valueOf(inputTokens))
                .add(outputUsdPerMillion.multiply(BigDecimal.valueOf(outputTokens)))
                .setScale(0, java.math.RoundingMode.CEILING).longValueExact();
    }

    public long monthlyBudgetMicros() {
        return monthlyBudgetUsd.movePointRight(6).setScale(0, java.math.RoundingMode.FLOOR).longValueExact();
    }

    /** Never prints the key, so a log of the settings does not leak it. */
    @Override
    public String toString() {
        return "TranslationSettings[enabled=" + enabled() + ", model=" + model + ", effort=" + effort
                + ", maxOutputTokens=" + maxOutputTokens + ", timeout=" + timeout + ", locales=" + locales
                + ", glossaryLocales=" + glossaryLocales + ", region=" + region + ", glossaryTtl=" + glossaryTtl
                + ", imageHosts=" + imageHosts + ", maxImages=" + maxImages + ", maxImageBytes=" + maxImageBytes
                + ", hourlyPerRequester=" + hourlyPerRequester + ", monthlyBudgetUsd=" + monthlyBudgetUsd + "]";
    }
}
