package com.wikiaov.user.internal.web;

import com.wikiaov.user.internal.account.application.response.PasswordChallengeView;
import com.wikiaov.user.internal.account.application.response.PasswordChangeResult;
import com.wikiaov.user.internal.account.application.response.SecurityOverview;
import com.wikiaov.user.internal.account.application.response.SessionList;
import com.wikiaov.user.internal.web.request.PasswordChangeRequests;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;

/**
 * HTTP API documentation contract for account security (ADR-028). Runtime mappings and binding remain on the
 * controller; validation is inherited from this interface.
 */
@Tag(name = "user")
public interface AccountSecurityApi {

    @Operation(operationId = "accountSecurityApi_overview", summary = "Security overview - user", description = "Email, password, two-step sign-in and recovery code state of the caller's identity-provider account. Requires a valid bearer token of a human account. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "403", description = "Service accounts have no account security settings.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including USER_ACCOUNT_PROVIDER_UNAVAILABLE.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    SecurityOverview overview(@Parameter(hidden = true) HttpServletRequest http);

    @Operation(operationId = "accountSecurityApi_startPasswordChange", summary = "Start password change - user", description = "Mail a six-digit code to the account email. The code expires after 10 minutes and allows five wrong attempts; a new code replaces the previous one. Limited to one code per minute and five per hour. Requires a valid bearer token of a human account. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "403", description = "Service accounts cannot change passwords.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "201", description = "Code sent.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "409", description = "USER_EMAIL_MISSING: the account has no email.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "429", description = "USER_PASSWORD_CODE_RATE_LIMITED with retryAfterSeconds.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "503", description = "USER_MAIL_UNAVAILABLE or USER_ACCOUNT_PROVIDER_UNAVAILABLE.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<PasswordChallengeView> startPasswordChange(@Parameter(hidden = true) HttpServletRequest http,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "Optional JSON with the email language (vi or en).", required = false) @Valid PasswordChangeRequests.Start body);

    @Operation(operationId = "accountSecurityApi_confirmPasswordChange", summary = "Confirm password change - user", description = "Check the mailed code, then set the new password in the identity provider. The password is never stored or logged. Other sessions are signed out unless signOutOtherSessions is false. Requires a valid bearer token of the account that requested the code. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "403", description = "Service accounts cannot change passwords.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "200", description = "Password changed.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "400", description = "USER_PASSWORD_CODE_INVALID with attemptsRemaining, or an invalid body.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "404", description = "USER_PASSWORD_CHALLENGE_NOT_FOUND.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "409", description = "USER_PASSWORD_CHANGE_IN_PROGRESS.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "410", description = "USER_PASSWORD_CODE_EXPIRED: expired, used, replaced, failed or out of attempts.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "422", description = "USER_PASSWORD_REJECTED with the identity provider policy key.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    PasswordChangeResult confirmPasswordChange(@Parameter(hidden = true) HttpServletRequest http,
            @Parameter(description = "Challenge returned when the code was sent.") UUID challengeId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "Code, new password and sign-out choice. Unknown properties are rejected.", required = true) @Valid PasswordChangeRequests.Confirm body);

    @Operation(operationId = "accountSecurityApi_sessions", summary = "Sessions - user", description = "Identity-provider sessions of the caller with IP, times, applications and, when available, browser and operating system. The current session comes first. Requires a valid bearer token of a human account. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "403", description = "Service accounts have no sessions to manage.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including USER_ACCOUNT_PROVIDER_UNAVAILABLE.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    SessionList sessions(@Parameter(hidden = true) HttpServletRequest http);

    @Operation(operationId = "accountSecurityApi_signOutSession", summary = "Sign out session - user", description = "End one other session of the caller. The current session is ended through the application's own sign-out. Requires a valid bearer token of a human account. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "403", description = "Service accounts have no sessions to manage.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "204", description = "Session ended.", content = @Content),
            @ApiResponse(responseCode = "404", description = "USER_SESSION_NOT_FOUND.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "409", description = "USER_SESSION_CURRENT.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<Void> signOutSession(@Parameter(hidden = true) HttpServletRequest http,
            @Parameter(description = "Identity-provider session id from the session list.") String sessionId);

    @Operation(operationId = "accountSecurityApi_signOutOtherSessions", summary = "Sign out other sessions - user", description = "End every session of the caller except the current one. Requires a valid bearer token of a human account. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "403", description = "Service accounts have no sessions to manage.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "200", description = "Number of sessions ended.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including USER_ACCOUNT_PROVIDER_UNAVAILABLE.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    SessionList.SignOutResult signOutOtherSessions(@Parameter(hidden = true) HttpServletRequest http);

    @Operation(operationId = "accountSecurityApi_removeRecoveryCodes", summary = "Remove recovery codes - user", description = "Remove recovery codes left after the authenticator app was removed in the identity provider. Refused while an authenticator app is configured. Requires a valid bearer token of a human account. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "403", description = "Service accounts have no recovery codes.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "204", description = "No recovery codes remain.", content = @Content),
            @ApiResponse(responseCode = "409", description = "USER_TWO_FACTOR_ACTIVE.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<Void> removeRecoveryCodes(@Parameter(hidden = true) HttpServletRequest http);
}
