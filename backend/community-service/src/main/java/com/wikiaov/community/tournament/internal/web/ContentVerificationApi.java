package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.tournament.internal.verification.application.ContentVerifications.Summary;
import com.wikiaov.community.tournament.internal.verification.application.ContentVerifications.Verify;
import com.wikiaov.community.tournament.internal.verification.application.ContentVerifications.View;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;

/** The owner's hand checks of tournament data, for Admin only (spec 04, tournament data verification). */
@Tag(name = "content verification")
public interface ContentVerificationApi {
    @Operation(operationId = "contentVerificationApi_summaries", summary = "Count the checked parts of every tournament")
    List<Summary> summaries(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "contentVerificationApi_list", summary = "List the checks of a tournament, newest first")
    List<View> list(UUID id, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "contentVerificationApi_verify", summary = "Record that a person checked one version of a part")
    View verify(UUID id, Verify body);

    @Operation(operationId = "contentVerificationApi_remove", summary = "Remove a check")
    ResponseEntity<Void> remove(UUID id, UUID verificationId);
}
