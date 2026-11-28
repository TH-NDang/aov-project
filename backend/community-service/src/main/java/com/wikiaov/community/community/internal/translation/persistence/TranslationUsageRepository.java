package com.wikiaov.community.community.internal.translation.persistence;

import java.time.Instant;
import java.time.LocalDate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface TranslationUsageRepository extends JpaRepository<TranslationUsage, LocalDate> {
    /** Native: adds one call to its month in a single statement, so concurrent calls never lose a count. */
    @Modifying
    @Query(value = """
            INSERT INTO community.translation_usage (month, calls, input_tokens, output_tokens, cost_micros, updated_at)
            VALUES (:month, 1, :inputTokens, :outputTokens, :costMicros, :at)
            ON CONFLICT (month) DO UPDATE SET calls = community.translation_usage.calls + 1,
                input_tokens = community.translation_usage.input_tokens + EXCLUDED.input_tokens,
                output_tokens = community.translation_usage.output_tokens + EXCLUDED.output_tokens,
                cost_micros = community.translation_usage.cost_micros + EXCLUDED.cost_micros,
                updated_at = EXCLUDED.updated_at
            """, nativeQuery = true)
    void add(LocalDate month, long inputTokens, long outputTokens, long costMicros, Instant at);
}
