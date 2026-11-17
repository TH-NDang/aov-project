package com.wikiaov.community.currency.internal.web;

import com.wikiaov.community.currency.internal.application.ExchangeRates;
import com.wikiaov.community.currency.internal.application.ExchangeRates.Rates;
import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.platform.ApiFieldError;
import com.wikiaov.community.platform.PlatformErrorCode;
import com.wikiaov.community.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Set;
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
        QueryParameters.requireOnly(request, Set.of(), Set.of("on"));

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
        return new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, detail,
                List.of(new ApiFieldError("on", "INVALID_VALUE", "Invalid value.")));
    }
}
