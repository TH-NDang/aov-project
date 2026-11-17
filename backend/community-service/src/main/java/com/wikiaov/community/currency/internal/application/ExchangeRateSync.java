package com.wikiaov.community.currency.internal.application;

import com.wikiaov.community.currency.internal.application.port.ExchangeRateSource;
import com.wikiaov.community.currency.internal.domain.DailyRate;
import com.wikiaov.community.currency.internal.persistence.ExchangeRateRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

/**
 * Keeps the rate history complete up to today. The first run fills the history a year at a time and stores each year
 * as it arrives, so a failure resumes where it stopped. Later runs fetch the last days again because a source may
 * publish a day late or correct it. Writes are idempotent, so overlapping instances cannot damage the history.
 */
@Service
public class ExchangeRateSync {
    static final int REFRESH_DAYS = 7;
    static final int WINDOW_DAYS = 366;

    private final ExchangeRateSource source;
    private final ExchangeRateRepository rates;
    private final ExchangeRateSettings settings;
    private final JsonMapper json;
    private final Clock clock;
    private boolean historyChecked;

    public ExchangeRateSync(ExchangeRateSource source, ExchangeRateRepository rates, ExchangeRateSettings settings,
            JsonMapper json, Clock clock) {
        this.source = source;
        this.rates = rates;
        this.settings = settings;
        this.json = json;
        this.clock = clock;
    }

    /** Returns how many rows were stored. */
    public int run() {
        var today = LocalDate.now(clock);
        var from = firstDayToFetch(today);

        var stored = 0;
        while (!from.isAfter(today)) {
            var to = from.plusDays(WINDOW_DAYS - 1L);
            if (to.isAfter(today))
                to = today;
            stored += store(source.fetch(from, to, settings.currencies()));
            from = to.plusDays(1);
        }

        historyChecked = true;
        return stored;
    }

    private LocalDate firstDayToFetch(LocalDate today) {
        var recent = today.minusDays(REFRESH_DAYS);
        // Once the history is known to be full, a currency the source lacks must not restart it on every run.
        if (historyChecked)
            return recent;

        Map<String, LocalDate> latest = rates.latestDays().stream()
                .collect(Collectors.toMap(ExchangeRateRepository.LatestDay::getCurrency,
                        ExchangeRateRepository.LatestDay::getLatest));
        var oldest = settings.currencies().stream().map(code -> latest.getOrDefault(code, settings.historyStart()))
                .min(Comparator.naturalOrder()).orElse(settings.historyStart());
        var from = oldest.minusDays(REFRESH_DAYS);

        return from.isBefore(settings.historyStart()) ? settings.historyStart() : from;
    }

    private int store(List<DailyRate> fetched) {
        if (fetched.isEmpty())
            return 0;

        var rows = fetched.stream().map(rate -> Map.of("currency", rate.currency(), "rate_date",
                rate.date().toString(), "units_per_usd", rate.unitsPerUsd())).toList();

        return rates.upsert(json.writeValueAsString(rows), source.name(), clock.instant());
    }
}
