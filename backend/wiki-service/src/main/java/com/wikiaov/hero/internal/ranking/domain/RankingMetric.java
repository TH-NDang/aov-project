package com.wikiaov.hero.internal.ranking.domain;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * A value shown on the game's hero ranking boards (ADR-025) and the kind of value it holds. Rates are percentages,
 * the per-match figures are averages, the counters name the heroes this hero wins against more often.
 */
public enum RankingMetric {
    TIER(Kind.TIER),
    WIN_RATE(Kind.PERCENT),
    PICK_RATE(Kind.PERCENT),
    BAN_RATE(Kind.PERCENT),
    COUNTER_1(Kind.HERO),
    COUNTER_2(Kind.HERO),
    COUNTER_3(Kind.HERO),
    DAMAGE_DEALT(Kind.AMOUNT),
    KILLS(Kind.AMOUNT),
    GOLD(Kind.AMOUNT),
    DAMAGE_TAKEN(Kind.AMOUNT),
    ASSISTS(Kind.AMOUNT);

    private static final Pattern TIER_VALUE = Pattern.compile("T[0-9]");
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal AMOUNT_LIMIT = new BigDecimal("9999999999.99");

    private final Kind kind;

    RankingMetric(Kind kind) {
        this.kind = kind;
    }

    public Kind kind() {
        return kind;
    }

    public static Optional<RankingMetric> parse(String value) {
        return Arrays.stream(values()).filter(metric -> metric.name().equals(value)).findFirst();
    }

    /**
     * Why the given content does not fit this metric, or empty when it does. Only the field of the metric's kind may be
     * set; an empty value is allowed only while it waits for review.
     */
    public Optional<String> problem(BigDecimal number, String tier, boolean hasHero, boolean needsReview) {
        boolean numberSet = number != null, tierSet = tier != null;
        if ((kind != Kind.PERCENT && kind != Kind.AMOUNT && numberSet) || (kind != Kind.TIER && tierSet)
                || (kind != Kind.HERO && hasHero)) {
            return Optional.of(name() + " takes only a " + kind.field + ".");
        }
        if (!numberSet && !tierSet && !hasHero) {
            return needsReview ? Optional.empty() : Optional.of(name() + " without a value must wait for review.");
        }

        if (tierSet && !TIER_VALUE.matcher(tier).matches()) {
            return Optional.of("A tier is T0 to T9.");
        }
        if (numberSet && (number.signum() < 0 || number.stripTrailingZeros().scale() > 2)) {
            return Optional.of(name() + " is a non-negative number with at most two decimals.");
        }
        if (numberSet && kind == Kind.PERCENT && number.compareTo(HUNDRED) > 0) {
            return Optional.of(name() + " is a percentage from 0 to 100.");
        }
        if (numberSet && number.compareTo(AMOUNT_LIMIT) > 0) {
            return Optional.of(name() + " is too large.");
        }
        return Optional.empty();
    }

    public enum Kind {
        TIER("tier"),
        PERCENT("number"),
        AMOUNT("number"),
        HERO("hero");

        private final String field;

        Kind(String field) {
            this.field = field;
        }
    }
}
