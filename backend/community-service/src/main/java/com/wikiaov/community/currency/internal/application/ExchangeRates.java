package com.wikiaov.community.currency.internal.application;

import com.wikiaov.community.currency.internal.persistence.ExchangeRateRepository;
import com.wikiaov.community.platform.ApiException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/** Reads the rate history. A day with no stored rate before it stays empty, so readers keep the original amount. */
@Service
public class ExchangeRates {
    static final int MAX_DAYS = 60;

    private final ExchangeRateRepository rates;
    private final ExchangeRateSettings settings;
    private final JsonMapper json;
    private final Clock clock;

    public ExchangeRates(ExchangeRateRepository rates, ExchangeRateSettings settings, JsonMapper json, Clock clock) {
        this.rates = rates;
        this.settings = settings;
        this.json = json;
        this.clock = clock;
    }

    /** Without any day, this answers for today, which is the newest rate of each currency. */
    @Transactional(readOnly = true)
    public Rates on(List<LocalDate> requested) {
        var days = requested.isEmpty() ? List.of(LocalDate.now(clock)) : requested.stream().distinct().toList();
        if (days.size() > MAX_DAYS)
            throw new ApiException(CurrencyErrorCode.EXCHANGE_RATE_INVALID_QUERY,
                    "Ask for at most " + MAX_DAYS + " days at a time.");

        var found = new HashMap<LocalDate, List<Rate>>();
        rates.effectiveOn(json.writeValueAsString(days.stream().map(LocalDate::toString).toList()),
                json.writeValueAsString(settings.currencies()))
                .forEach(row -> found.computeIfAbsent(LocalDate.parse(row.getDay()), day -> new ArrayList<>())
                        .add(new Rate(row.getCurrency(), row.getUnitsPerUsd(), LocalDate.parse(row.getRateDate()))));

        return new Rates("USD", days.stream().map(day -> new Day(day, found.getOrDefault(day, List.of()))).toList());
    }

    public record Rates(
            String base,
            List<Day> days
    ) {
    }

    public record Day(
            LocalDate on,
            List<Rate> rates
    ) {
    }

    public record Rate(
            String currency,
            BigDecimal unitsPerUsd,
            LocalDate rateDate
    ) {
    }
}
