package com.wikiaov.community.currency.internal.application.port;

import com.wikiaov.community.currency.internal.domain.DailyRate;
import java.time.LocalDate;
import java.util.List;

/** Where daily rates come from. Calls leave the service, so they must never run inside a database transaction. */
public interface ExchangeRateSource {
    String name();

    /** Rates against the US dollar for each day of the inclusive range. A day or currency it lacks is left out. */
    List<DailyRate> fetch(LocalDate from, LocalDate to, List<String> currencies);
}
