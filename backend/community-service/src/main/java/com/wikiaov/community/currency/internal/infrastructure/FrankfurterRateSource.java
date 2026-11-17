package com.wikiaov.community.currency.internal.infrastructure;

import com.wikiaov.community.currency.internal.application.ExchangeRateSettings;
import com.wikiaov.community.currency.internal.application.port.ExchangeRateSource;
import com.wikiaov.community.currency.internal.domain.DailyRate;
import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Reads the blended daily rates of Frankfurter (see ADR-020). */
@Component
class FrankfurterRateSource implements ExchangeRateSource {
    private final RestClient client;

    FrankfurterRateSource(ExchangeRateSettings settings) {
        var factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(60));
        client = RestClient.builder().baseUrl(settings.sourceUrl()).requestFactory(factory)
                .defaultHeader("User-Agent", "aov-community-service").build();
    }

    @Override
    public String name() {
        return "frankfurter";
    }

    @Override
    public List<DailyRate> fetch(LocalDate from, LocalDate to, List<String> currencies) {
        var rows = client.get()
                .uri(uri -> uri.path("/v2/rates").queryParam("from", from).queryParam("to", to)
                        .queryParam("base", "USD").queryParam("quotes", String.join(",", currencies)).build())
                .retrieve().body(Row[].class);
        if (rows == null) {
            return List.of();
        }

        var wanted = Set.copyOf(currencies);
        return Arrays.stream(rows).filter(row -> usable(row, wanted))
                .map(row -> new DailyRate(row.quote(), row.date(), row.rate())).toList();
    }

    private static boolean usable(Row row, Set<String> wanted) {
        return "USD".equals(row.base()) && wanted.contains(row.quote()) && row.date() != null && row.rate() != null
                && row.rate().signum() > 0;
    }

    record Row(
            LocalDate date,
            String base,
            String quote,
            BigDecimal rate
    ) {
    }
}
