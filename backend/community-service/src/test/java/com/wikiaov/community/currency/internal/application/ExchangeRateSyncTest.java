package com.wikiaov.community.currency.internal.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.wikiaov.community.currency.internal.application.port.ExchangeRateSource;
import com.wikiaov.community.currency.internal.domain.DailyRate;
import com.wikiaov.community.currency.internal.persistence.ExchangeRateRepository;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class ExchangeRateSyncTest {
    static final LocalDate TODAY = LocalDate.parse("2026-11-06");
    static final LocalDate START = LocalDate.parse("2024-01-01");
    final ExchangeRateRepository rates = mock(ExchangeRateRepository.class);
    final FakeSource source = new FakeSource();
    final ExchangeRateSync sync = new ExchangeRateSync(source, rates,
            new ExchangeRateSettings("https://rates.example", START, List.of("VND", "THB")),
            JsonMapper.builder().build(), Clock.fixed(Instant.parse("2026-11-06T02:00:00Z"), ZoneOffset.UTC));

    record Range(
            LocalDate from,
            LocalDate to
    ) {
    }

    static class FakeSource implements ExchangeRateSource {
        final List<Range> asked = new ArrayList<>();
        RuntimeException failure;
        int failAtRequest = -1;

        @Override
        public String name() {
            return "fake";
        }

        @Override
        public List<DailyRate> fetch(LocalDate from, LocalDate to, List<String> currencies) {
            if (asked.size() == failAtRequest)
                throw failure;
            asked.add(new Range(from, to));
            return List.of(new DailyRate("VND", to, new BigDecimal("25000")));
        }
    }

    record Latest(
            String getCurrency,
            LocalDate getLatest
    ) implements ExchangeRateRepository.LatestDay {
    }

    private void stored(Map<String, String> latest) {
        List<ExchangeRateRepository.LatestDay> days = latest.entrySet()
                .stream().<ExchangeRateRepository.LatestDay>map(
                        entry -> new Latest(entry.getKey(), LocalDate.parse(entry.getValue())))
                .toList();
        when(rates.latestDays()).thenReturn(days);
    }

    @Test
    void anEmptyHistoryIsFilledAYearAtATimeUpToToday() {
        stored(Map.of());

        sync.run();

        assertThat(source.asked).first().isEqualTo(new Range(START, START.plusDays(365)));
        assertThat(source.asked).last().extracting(Range::to).isEqualTo(TODAY);
        for (int index = 1; index < source.asked.size(); index++)
            assertThat(source.asked.get(index).from()).isEqualTo(source.asked.get(index - 1).to().plusDays(1));
        verify(rates, times(source.asked.size())).upsert(anyString(), eq("fake"), any());
    }

    @Test
    void aFullHistoryOnlyFetchesRecentDaysAgainBecauseSourcesCorrectThem() {
        stored(Map.of("VND", "2026-11-05", "THB", "2026-11-05"));

        sync.run();

        assertThat(source.asked).containsExactly(new Range(LocalDate.parse("2026-10-29"), TODAY));
    }

    @Test
    void aCurrencyAddedLaterFillsItsHistoryOnce() {
        stored(Map.of("VND", "2026-11-05"));

        sync.run();
        assertThat(source.asked).first().extracting(Range::from).isEqualTo(START);

        source.asked.clear();
        sync.run();
        assertThat(source.asked).as("a currency the source lacks must not restart the history on every run")
                .containsExactly(new Range(TODAY.minusDays(7), TODAY));
    }

    @Test
    void aFailureKeepsWhatWasStoredAndTheNextRunResumesThere() {
        stored(Map.of());
        source.failAtRequest = 1;
        source.failure = new IllegalStateException("source is down");

        assertThatThrownBy(sync::run).isSameAs(source.failure);
        verify(rates, times(1)).upsert(anyString(), anyString(), any());

        source.failAtRequest = -1;
        source.asked.clear();
        var reached = START.plusDays(365).toString();
        stored(Map.of("VND", reached, "THB", reached));

        sync.run();

        assertThat(source.asked).first().extracting(Range::from).isEqualTo(START.plusDays(358));
    }

    @Test
    void nothingToStoreDoesNotTouchTheDatabase() {
        var empty = mock(ExchangeRateSource.class);
        when(empty.fetch(any(), any(), anyList())).thenReturn(List.of());
        stored(Map.of("VND", "2026-11-05", "THB", "2026-11-05"));

        var quiet = new ExchangeRateSync(empty, rates,
                new ExchangeRateSettings("https://rates.example", START, List.of("VND", "THB")),
                JsonMapper.builder().build(), Clock.fixed(Instant.parse("2026-11-06T02:00:00Z"), ZoneOffset.UTC));

        assertThat(quiet.run()).isZero();
        verify(rates, never()).upsert(anyString(), anyString(), any());
    }
}
