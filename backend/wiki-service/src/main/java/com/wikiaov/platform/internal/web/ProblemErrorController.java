package com.wikiaov.platform.internal.web;

import com.wikiaov.platform.ApiErrorCode;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import com.wikiaov.platform.ProblemDetails;
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.boot.webmvc.error.ErrorController;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Replaces Spring Boot's default {@code /error} JSON so that errors raised outside Spring MVC
 * (e.g. an exception thrown by a servlet filter) still follow the ProblemDetail contract.
 */
@RestController
class ProblemErrorController implements ErrorController {

    @RequestMapping("${server.error.path:/error}")
    ResponseEntity<ProblemDetail> error(HttpServletRequest request) {
        Throwable failure = (Throwable) request.getAttribute(RequestDispatcher.ERROR_EXCEPTION);
        ApiException apiException = findApiException(failure);
        ApiErrorCode code = apiException != null
                ? apiException.getErrorCode()
                : codeFor(request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE));
        String detail = apiException != null ? apiException.getMessage() : code.title() + ".";

        ProblemDetail body = apiException != null
                ? ProblemDetails.of(code, detail, apiException.getErrors(), apiException.getContext(), request)
                : ProblemDetails.of(code, detail, List.of(), Map.of(), request);
        // During the error dispatch the request URI is /error; report the URI that actually failed.
        if (request.getAttribute(RequestDispatcher.ERROR_REQUEST_URI) instanceof String originalUri) {
            body.setInstance(URI.create(originalUri));
        }
        return ResponseEntity.status(code.status())
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(body);
    }

    static PlatformErrorCode codeFor(Object statusAttribute) {
        int status = statusAttribute instanceof Integer value ? value : 500;
        return switch (status) {
            case 401 -> PlatformErrorCode.UNAUTHENTICATED;
            case 403 -> PlatformErrorCode.FORBIDDEN;
            case 404 -> PlatformErrorCode.RESOURCE_NOT_FOUND;
            case 405 -> PlatformErrorCode.METHOD_NOT_ALLOWED;
            case 406 -> PlatformErrorCode.NOT_ACCEPTABLE;
            case 413 -> PlatformErrorCode.PAYLOAD_TOO_LARGE;
            case 415 -> PlatformErrorCode.UNSUPPORTED_MEDIA_TYPE;
            default -> status >= 500 ? PlatformErrorCode.INTERNAL_ERROR : PlatformErrorCode.INVALID_REQUEST;
        };
    }

    private static ApiException findApiException(Throwable failure) {
        for (Throwable current = failure; current != null; current = current.getCause()) {
            if (current instanceof ApiException api) {
                return api;
            }
            if (current.getCause() == current) {
                break;
            }
        }
        return null;
    }
}
