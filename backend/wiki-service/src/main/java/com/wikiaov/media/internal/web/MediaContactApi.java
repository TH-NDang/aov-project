package com.wikiaov.media.internal.web;

import com.wikiaov.media.internal.web.request.ContactRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;

public interface MediaContactApi {
    record Receipt(
            UUID id
    ) {
    }

    @Operation(operationId = "mediaContactApi_submit", summary = "Contact WikiAOV about media or sources", description = "Store a private contact request. No authentication is required. Asset and version must be supplied together. Limited to five submissions per connection address every ten minutes on each instance.", responses = {
            @ApiResponse(responseCode = "201", description = "Request stored; only a receipt identifier is returned.", useReturnTypeSchema = true)})
    ResponseEntity<Receipt> submit(HttpServletRequest http, @Valid ContactRequest request);
}
