package com.wikiaov.community.currency.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.community.currency.internal.application.ExchangeRateSync;
import com.wikiaov.community.currency.internal.application.port.ExchangeRateSource;
import com.wikiaov.community.currency.internal.domain.DailyRate;
import com.wikiaov.community.currency.internal.persistence.ExchangeRateRepository;
import com.wikiaov.community.testsupport.CommunityApplicationTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;

@CommunityApplicationTest
class ExchangeRateApiIntegrationTest {
    static final String RATES = "/api/community/v1/exchange-rates";
    @Autowired
    MockMvc mvc;
    @Autowired
    ExchangeRateRepository rates;
    @Autowired
    ExchangeRateSync sync;
    @Autowired
    JsonMapper json;
    @Autowired
    JdbcTemplate jdbc;
    @MockitoBean
    JwtDecoder decoder;
    @MockitoBean
    ExchangeRateSource source;

    @BeforeEach
    void emptyHistory() {
        jdbc.execute("TRUNCATE currency.exchange_rate");
    }

    private void store(String currency, String date, String rate) {
        rates.upsert(json.writeValueAsString(List.of(new Row(currency, date, new BigDecimal(rate)))), "test",
                Instant.parse("2026-01-01T00:00:00Z"));
    }

    record Row(
            String currency,
            String rate_date,
            BigDecimal units_per_usd
    ) {
    }

    @Test
    void aDayReadsTheNewestRateOnOrBeforeItAndKeepsThatRatesDate() throws Exception {
        store("VND", "2020-03-02", "23216");
        store("VND", "2020-03-06", "23300");
        store("THB", "2020-03-04", "31.5");

        mvc.perform(get(RATES).param("on", "2020-03-05")).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "max-age=3600, public"))
                .andExpect(jsonPath("$.base").value("USD")).andExpect(jsonPath("$.days[0].on").value("2020-03-05"))
                .andExpect(jsonPath("$.days[0].rates", hasSize(2)))
                .andExpect(jsonPath("$.days[0].rates[0].currency").value("THB"))
                .andExpect(jsonPath("$.days[0].rates[0].unitsPerUsd").value(31.5))
                .andExpect(jsonPath("$.days[0].rates[0].rateDate").value("2020-03-04"))
                .andExpect(jsonPath("$.days[0].rates[1].currency").value("VND"))
                .andExpect(jsonPath("$.days[0].rates[1].unitsPerUsd").value(23216))
                .andExpect(jsonPath("$.days[0].rates[1].rateDate").value("2020-03-02"));
    }

    @Test
    void aDayOlderThanTheHistoryStaysEmptyInsteadOfBorrowingALaterRate() throws Exception {
        store("VND", "2020-03-02", "23216");

        mvc.perform(get(RATES).param("on", "2010-01-01,2020-03-03")).andExpect(status().isOk())
                .andExpect(jsonPath("$.days[0].on").value("2010-01-01"))
                .andExpect(jsonPath("$.days[0].rates", hasSize(0)))
                .andExpect(jsonPath("$.days[1].on").value("2020-03-03"))
                .andExpect(jsonPath("$.days[1].rates[0].rateDate").value("2020-03-02"));
    }

    @Test
    void withoutADayItAnswersWithTheNewestRates() throws Exception {
        store("IDR", "2020-01-01", "13900");
        store("IDR", "2021-06-01", "14200");

        var body = mvc.perform(get(RATES)).andExpect(status().isOk())
                .andExpect(jsonPath("$.days", hasSize(1))).andReturn().getResponse().getContentAsString();

        assertThat(body).contains("\"rateDate\":\"2021-06-01\"").doesNotContain("\"rateDate\":\"2020-01-01\"");
    }

    @Test
    void repeatingADayAnswersItOnce() throws Exception {
        mvc.perform(get(RATES).param("on", "2020-03-05", "2020-03-05")).andExpect(jsonPath("$.days", hasSize(1)));
    }

    @Test
    void badQueriesAreRejected() throws Exception {
        mvc.perform(get(RATES).param("on", "05/03/2020")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"));
        mvc.perform(get(RATES).param("unexpected", "1")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"));

        var tooMany = IntStream.range(0, 61)
                .mapToObj(index -> LocalDate.parse("2020-01-01").plusDays(index).toString()).toArray(String[]::new);
        mvc.perform(get(RATES).param("on", tooMany)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"));
    }

    @Test
    void theSyncStoresFetchedRatesAndAReFetchCorrectsADay() {
        Mockito.when(source.name()).thenReturn("fake");
        Mockito
                .when(source.fetch(ArgumentMatchers.any(), ArgumentMatchers.any(),
                        ArgumentMatchers.anyList()))
                .thenReturn(List.of(new DailyRate("TWD", LocalDate.parse("2024-02-01"), new BigDecimal("30.5"))))
                .thenReturn(List.of(new DailyRate("TWD", LocalDate.parse("2024-02-01"), new BigDecimal("31.25"))));

        sync.run();
        sync.run();

        var found = rates.effectiveOn("[\"2024-02-01\"]", "[\"TWD\"]");
        assertThat(found).hasSize(1);
        assertThat(found.getFirst().getUnitsPerUsd()).isEqualByComparingTo("31.25");
        assertThat(found.getFirst().getRateDate()).isEqualTo("2024-02-01");
    }
}
