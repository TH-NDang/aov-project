package com.wikiaov.community.currency.internal.persistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface ExchangeRateRepository extends Repository<ExchangeRateRecord, ExchangeRateRecord.Key> {
    /** Rows are a JSON array, so a year of rates is one statement. A later fetch of a day corrects the earlier one. */
    @Transactional
    @Modifying
    @Query(value = """
        INSERT INTO currency.exchange_rate (currency, rate_date, units_per_usd, source, fetched_at)
        SELECT r.currency, r.rate_date, r.units_per_usd, CAST(:source AS varchar), CAST(:fetchedAt AS timestamptz)
          FROM jsonb_to_recordset(CAST(:rows AS jsonb))
               AS r(currency text, rate_date date, units_per_usd numeric)
        ON CONFLICT (currency, rate_date) DO UPDATE
           SET units_per_usd = EXCLUDED.units_per_usd,
               source = EXCLUDED.source,
               fetched_at = EXCLUDED.fetched_at
        """, nativeQuery = true)
    int upsert(@Param("rows") String rows, @Param("source") String source, @Param("fetchedAt") Instant fetchedAt);

    @Query("""
        select rate.key.currency as currency, max(rate.key.rateDate) as latest
          from ExchangeRateRecord rate
         group by rate.key.currency
        """)
    List<LatestDay> latestDays();

    /** For each day and currency, the newest rate published on or before that day. Days and currencies are JSON arrays. */
    @Query(value = """
        SELECT d.day AS day, r.currency AS currency, CAST(r.rate_date AS text) AS rateDate,
               r.units_per_usd AS unitsPerUsd
          FROM jsonb_array_elements_text(CAST(:days AS jsonb)) AS d(day)
         CROSS JOIN jsonb_array_elements_text(CAST(:currencies AS jsonb)) AS c(code)
         CROSS JOIN LATERAL (
               SELECT e.currency, e.rate_date, e.units_per_usd
                 FROM currency.exchange_rate e
                WHERE e.currency = c.code AND e.rate_date <= CAST(d.day AS date)
                ORDER BY e.rate_date DESC
                LIMIT 1
         ) r
         ORDER BY d.day, r.currency
        """, nativeQuery = true)
    List<EffectiveRate> effectiveOn(@Param("days") String days, @Param("currencies") String currencies);

    interface LatestDay {
        String getCurrency();

        LocalDate getLatest();
    }

    interface EffectiveRate {
        String getDay();

        String getCurrency();

        String getRateDate();

        BigDecimal getUnitsPerUsd();
    }
}
