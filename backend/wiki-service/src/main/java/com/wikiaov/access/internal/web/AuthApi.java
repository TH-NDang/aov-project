package com.wikiaov.access.internal.web;

import com.wikiaov.access.internal.application.response.AuthTokenResponse;
import com.wikiaov.access.internal.web.request.LoginRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.ResponseEntity;

/** Cookie-backed auth endpoints use an exact origin and a mandatory non-simple header for CSRF defense. */
@Tag(name = "auth")
public interface AuthApi {

    @Operation(operationId = "authApi_config", summary = "Config - auth", description = "Return googleEnabled, indicating whether Google login and its provider secret are configured. No credentials are exposed. Unknown query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    Map<String, Boolean> config(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "authApi_login", summary = "Login - auth", description = "Exchange username/password for an access token and an HttpOnly refresh cookie. Requires the exact configured Origin and X-AOV-Auth: 1. Rate limits apply per IP and username. Unknown query parameters are rejected.", parameters = {
            @Parameter(name = "Origin", in = ParameterIn.HEADER, required = true, schema = @Schema(type = "string"), description = "Must exactly match the configured admin origin."),
            @Parameter(name = "X-AOV-Auth", in = ParameterIn.HEADER, required = true, schema = @Schema(allowableValues = {
                    "1"}), description = "Mandatory non-simple CSRF defense header.")}, responses = {
                            @ApiResponse(responseCode = "200", headers = @Header(name = "Set-Cookie", description = "HttpOnly session or flow-binding cookie update; refresh tokens are not returned in JSON.", schema = @Schema(type = "string")), description = "Successful operation.", useReturnTypeSchema = true),
                            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
                    })
    AuthTokenResponse login(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid LoginRequest body,
            @Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) HttpServletResponse response);

    @Operation(operationId = "authApi_refresh", summary = "Refresh - auth", description = "Rotate the refresh cookie and return a new access token. Requires aov_admin_refresh cookie, the exact configured Origin and X-AOV-Auth: 1. Provider 401/403 clears the cookie; upstream failures preserve it. Rate limits apply per IP. Unknown query parameters are rejected.", parameters = {
            @Parameter(name = "Origin", in = ParameterIn.HEADER, required = true, schema = @Schema(type = "string"), description = "Must exactly match the configured admin origin."),
            @Parameter(name = "X-AOV-Auth", in = ParameterIn.HEADER, required = true, schema = @Schema(allowableValues = {
                    "1"}), description = "Mandatory non-simple CSRF defense header."),
            @Parameter(name = "aov_admin_refresh", in = ParameterIn.COOKIE, required = true, schema = @Schema(type = "string"), description = "HttpOnly refresh cookie set by login or refresh.")}, responses = {
                    @ApiResponse(responseCode = "200", headers = @Header(name = "Set-Cookie", description = "HttpOnly session or flow-binding cookie update; refresh tokens are not returned in JSON.", schema = @Schema(type = "string")), description = "Successful operation.", useReturnTypeSchema = true),
                    @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
            })
    AuthTokenResponse refresh(@Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) HttpServletResponse response);

    @Operation(operationId = "authApi_logout", summary = "Logout - auth", description = "Revoke the current refresh token if present, then clear its cookie. Requires the exact configured Origin and X-AOV-Auth: 1. An upstream failure preserves the cookie for retry. Unknown query parameters are rejected.", parameters = {
            @Parameter(name = "Origin", in = ParameterIn.HEADER, required = true, schema = @Schema(type = "string"), description = "Must exactly match the configured admin origin."),
            @Parameter(name = "X-AOV-Auth", in = ParameterIn.HEADER, required = true, schema = @Schema(allowableValues = {
                    "1"}), description = "Mandatory non-simple CSRF defense header."),
            @Parameter(name = "aov_admin_refresh", in = ParameterIn.COOKIE, required = false, schema = @Schema(type = "string"), description = "HttpOnly refresh cookie set by login or refresh.")}, responses = {
                    @ApiResponse(responseCode = "204", headers = @Header(name = "Set-Cookie", description = "HttpOnly session or flow-binding cookie update; refresh tokens are not returned in JSON.", schema = @Schema(type = "string")), description = "Successful operation; no response body.", content = @Content),
                    @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
            })
    ResponseEntity<Void> logout(@Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) HttpServletResponse response);

    @Operation(operationId = "authApi_google", summary = "Google - auth", description = "Start a configured Google OAuth flow. Returns state and authorizationUrl, and sets a short-lived HttpOnly flow-binding cookie. Requires the exact configured Origin and X-AOV-Auth: 1. Rate limits apply per IP. Unknown query parameters are rejected.", parameters = {
            @Parameter(name = "Origin", in = ParameterIn.HEADER, required = true, schema = @Schema(type = "string"), description = "Must exactly match the configured admin origin."),
            @Parameter(name = "X-AOV-Auth", in = ParameterIn.HEADER, required = true, schema = @Schema(allowableValues = {
                    "1"}), description = "Mandatory non-simple CSRF defense header.")}, responses = {
                            @ApiResponse(responseCode = "200", headers = @Header(name = "Set-Cookie", description = "HttpOnly session or flow-binding cookie update; refresh tokens are not returned in JSON.", schema = @Schema(type = "string")), description = "Successful operation.", useReturnTypeSchema = true),
                            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
                    })
    Map<String, String> google(@Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) HttpServletResponse response);

    @Operation(operationId = "authApi_callback", summary = "Callback - auth", description = "Consume the single-use OAuth state and its aov_oauth_{state} cookie. Exchange the code, or record cancellation/provider failure, then redirect with state/status in the fragment. The flow cookie is cleared. Only state, code, error, error_description, session_state and iss query keys are accepted.", responses = {
            @ApiResponse(responseCode = "303", headers = @Header(name = "Location", description = "Configured login completion URI with state/status fragment.", schema = @Schema(type = "string", format = "uri")), description = "Redirect to the configured login completion URI.", content = @Content),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<Void> callback(
            @Parameter(description = "One-time OAuth state, bound to the initiating browser cookie.") String state,
            @Parameter(description = "Authorization code returned by the identity provider.") String code,
            @Parameter(description = "OAuth error returned by the identity provider.") String error,
            @Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) HttpServletResponse response);
}
