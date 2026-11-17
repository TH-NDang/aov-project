package com.wikiaov.community.currency.internal.web;

import com.wikiaov.community.currency.internal.application.ExchangeRates.Rates;
import com.wikiaov.community.platform.ApiPaths;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Tag(name = "currency")
@RequestMapping(version = "1")
public interface ExchangeRateApi {
    @Operation(operationId = "exchangeRateApi_rates", summary = "Exchange rates by day - currency", description = "Public. For each requested day and each stored currency, returns the newest rate published on or before that day, with the date of that rate. Without `on`, answers for today. A day older than the stored history returns an empty list, so clients keep the original amount. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Rates in units per US dollar.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "400", description = "A day is not yyyy-mm-dd, more than 60 days were requested, or the query has an unknown parameter.", content = @Content(mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping(ApiPaths.ROOT + "/exchange-rates")
    ResponseEntity<Rates> rates(
            @Parameter(description = "Days as yyyy-mm-dd, repeated or comma separated; at most 60.") @RequestParam(required = false) List<String> on,
            @Parameter(hidden = true) HttpServletRequest request);
}
