package com.wikiaov.community.currency.internal.web;

import com.wikiaov.community.currency.internal.application.CurrencyErrorCode;
import com.wikiaov.community.currency.internal.application.ExchangeRates;
import com.wikiaov.community.currency.internal.application.ExchangeRates.Rates;
import com.wikiaov.community.platform.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
class ExchangeRateController implements ExchangeRateApi {
    private final ExchangeRates rates;

    ExchangeRateController(ExchangeRates rates) {
        this.rates = rates;
    }

    @Override
    public ResponseEntity<Rates> rates(List<String> on, HttpServletRequest request) {
        for (var name : request.getParameterMap().keySet())
            if (!name.equals("on"))
                throw invalid("Unsupported query parameter: " + name);

        var days = on == null ? List.<LocalDate>of() : on.stream().map(ExchangeRateController::day).toList();

        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .body(rates.on(days));
    }

    private static LocalDate day(String value) {
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException failure) {
            throw invalid("Days must be written as yyyy-mm-dd.");
        }
    }

    private static ApiException invalid(String detail) {
        return new ApiException(CurrencyErrorCode.EXCHANGE_RATE_INVALID_QUERY, detail);
    }
}
