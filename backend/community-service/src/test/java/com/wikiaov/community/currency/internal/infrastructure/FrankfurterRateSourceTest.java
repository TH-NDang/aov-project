package com.wikiaov.community.currency.internal.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import com.wikiaov.community.currency.internal.application.ExchangeRateSettings;
import com.wikiaov.community.currency.internal.domain.DailyRate;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClientException;

class FrankfurterRateSourceTest {
    static final LocalDate FROM = LocalDate.parse("2020-03-01");
    static final LocalDate TO = LocalDate.parse("2020-03-02");
    final AtomicReference<String> query = new AtomicReference<>();
    HttpServer server;
    FrankfurterRateSource source;
    int status = 200;
    String body = "[]";

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v2/rates", exchange -> {
            query.set(exchange.getRequestURI().getQuery());
            var bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        source = new FrankfurterRateSource(new ExchangeRateSettings(
                "http://127.0.0.1:" + server.getAddress().getPort(), FROM, List.of("VND", "THB")));
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void asksForTheRangeAgainstTheDollarAndReadsEachRow() {
        body = """
                [{"date":"2020-03-01","base":"USD","quote":"THB","rate":31.556},
                 {"date":"2020-03-02","base":"USD","quote":"VND","rate":23216}]
                """;

        assertThat(source.fetch(FROM, TO, List.of("VND", "THB"))).containsExactly(
                new DailyRate("THB", FROM, new BigDecimal("31.556")),
                new DailyRate("VND", TO, new BigDecimal("23216")));
        assertThat(query.get()).contains("from=2020-03-01", "to=2020-03-02", "base=USD", "quotes=VND,THB");
    }

    @Test
    void aRowThatCouldShowAWrongAmountIsDropped() {
        body = """
                [{"date":"2020-03-01","base":"EUR","quote":"VND","rate":25000},
                 {"date":"2020-03-01","base":"USD","quote":"JPY","rate":108},
                 {"date":"2020-03-01","base":"USD","quote":"VND","rate":0},
                 {"date":"2020-03-01","base":"USD","quote":"VND","rate":-1},
                 {"date":"2020-03-01","base":"USD","quote":"VND"},
                 {"base":"USD","quote":"VND","rate":23000},
                 {"date":"2020-03-02","base":"USD","quote":"VND","rate":23216}]
                """;

        assertThat(source.fetch(FROM, TO, List.of("VND"))).containsExactly(
                new DailyRate("VND", TO, new BigDecimal("23216")));
    }

    @Test
    void aFailingSourceIsReportedSoNothingIsStored() {
        status = 503;

        assertThatThrownBy(() -> source.fetch(FROM, TO, List.of("VND"))).isInstanceOf(RestClientException.class);
    }
}
