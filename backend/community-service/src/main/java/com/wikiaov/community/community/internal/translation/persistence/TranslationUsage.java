package com.wikiaov.community.community.internal.translation.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

/** Calls to the Claude API in one calendar month (UTC), for the monthly budget. */
@Entity
@Table(schema = "community", name = "translation_usage")
public class TranslationUsage {
    @Id
    private LocalDate month;
    private long calls;
    private long inputTokens;
    private long outputTokens;
    private long costMicros;
    private Instant updatedAt;

    public LocalDate getMonth() {
        return month;
    }

    public long getCalls() {
        return calls;
    }

    public long getInputTokens() {
        return inputTokens;
    }

    public long getOutputTokens() {
        return outputTokens;
    }

    public long getCostMicros() {
        return costMicros;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
