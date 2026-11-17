package com.wikiaov.community.currency.internal.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** How many units of a currency one US dollar bought on a day. Rows are written only by the rate sync. */
@Entity
@Table(schema = "currency", name = "exchange_rate")
public class ExchangeRateRecord {
    @EmbeddedId
    private Key key;
    @Column(name = "units_per_usd", nullable = false)
    private BigDecimal unitsPerUsd;
    @Column(nullable = false, length = 40)
    private String source;
    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt;

    protected ExchangeRateRecord() {
    }

    @Embeddable
    public record Key(
            @Column(nullable = false, length = 3) String currency,
            @Column(name = "rate_date", nullable = false) LocalDate rateDate
    ) implements Serializable {
    }
}
