package com.wikiaov.platform.internal.web;

import com.wikiaov.platform.ApiErrorCode;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.ApiFieldError;
import com.wikiaov.platform.PlatformErrorCode;
import com.wikiaov.platform.ProblemDetails;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.TypeMismatchException;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.accept.InvalidApiVersionException;
import org.springframework.web.accept.MissingApiVersionException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.exc.UnrecognizedPropertyException;

/**
 * Renders every error raised inside Spring MVC as
 * {@code application/problem+json} with a stable {@code code}.
 *
 * <p>
 * Codes are chosen by exception type, never guessed from the HTTP status,
 * because several different
 * errors share 400. Every error response is {@code Cache-Control: no-store}.
 * Errors raised by the security
 * filter chain (before MVC) are rendered by the access module through the same
 * {@link ProblemDetails}.
 */
@RestControllerAdvice
class ProblemDetailsExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ProblemDetailsExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<Object> handleApiException(ApiException ex, WebRequest request) {
        return render(ex, new HttpHeaders(), request);
    }

    /**
     * {@code @PreAuthorize} denials happen inside MVC; without this they would fall
     * into the 500 handler.
     */
    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<Object> handleAccessDenied(AccessDeniedException ex, WebRequest request) {
        return render(PlatformErrorCode.FORBIDDEN, "You do not have permission to perform this action.",
                List.of(), new HttpHeaders(), request);
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<Object> handleAuthentication(AuthenticationException ex, WebRequest request) {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
        return render(PlatformErrorCode.UNAUTHENTICATED, "A valid bearer token is required.", List.of(),
                headers, request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Object> handleUnexpected(Exception ex, WebRequest request) {
        log.error("Unexpected error", ex);
        return render(PlatformErrorCode.INTERNAL_ERROR, "An unexpected error occurred.", List.of(),
                new HttpHeaders(), request);
    }

    // ---- Spring MVC exceptions with a precise code
    // ------------------------------------------------------

    /**
     * Converters may throw ApiException (e.g. UNSUPPORTED_REGION); Spring wraps it,
     * so unwrap it here.
     */
    @Override
    protected ResponseEntity<Object> handleTypeMismatch(TypeMismatchException ex, HttpHeaders headers,
            HttpStatusCode status, WebRequest request) {
        ApiException cause = findCause(ex, ApiException.class);
        if (cause != null) {
            return render(cause, headers, request);
        }
        String name = ex.getPropertyName() != null ? ex.getPropertyName() : "parameter";
        if (ex instanceof MethodArgumentTypeMismatchException mismatch
                && mismatch.getParameter().hasParameterAnnotation(PathVariable.class)) {
            return render(PlatformErrorCode.INVALID_REQUEST, "Path variable '" + name + "' has an invalid value.",
                    List.of(new ApiFieldError(name, "INVALID_VALUE", "Invalid value.")), headers, request);
        }
        return render(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                "Query parameter '" + name + "' has an invalid value.",
                List.of(new ApiFieldError(name, "INVALID_VALUE", "Invalid value.")), headers, request);
    }

    @Override
    protected ResponseEntity<Object> handleMissingServletRequestParameter(MissingServletRequestParameterException ex,
            HttpHeaders headers, HttpStatusCode status,
            WebRequest request) {
        return render(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                "Query parameter '" + ex.getParameterName() + "' is required.",
                List.of(new ApiFieldError(ex.getParameterName(), "REQUIRED", "Parameter is required.")),
                headers, request);
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
            HttpHeaders headers, HttpStatusCode status,
            WebRequest request) {
        List<ApiFieldError> errors = new ArrayList<>();
        ex.getBindingResult().getFieldErrors().forEach(error -> errors
                .add(new ApiFieldError(error.getField(), constraintCode(error), error.getDefaultMessage())));
        ex.getBindingResult().getGlobalErrors()
                .forEach(error -> errors.add(new ApiFieldError("", constraintCode(error), error.getDefaultMessage())));
        return render(PlatformErrorCode.INVALID_REQUEST, "Request content is invalid.", errors, headers, request);
    }

    /**
     * Constraints on method parameters, e.g.
     * {@code @Min(0) @RequestParam int page}.
     */
    @Override
    protected ResponseEntity<Object> handleHandlerMethodValidationException(HandlerMethodValidationException ex,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {
        List<ApiFieldError> errors = new ArrayList<>();
        boolean onlyQueryParameters = true;
        for (var result : ex.getParameterValidationResults()) {
            String parameter = String.valueOf(result.getMethodParameter().getParameterName());
            onlyQueryParameters &= result.getMethodParameter().hasParameterAnnotation(RequestParam.class);
            for (MessageSourceResolvable error : result.getResolvableErrors()) {
                String path = error instanceof FieldError field ? parameter + "." + field.getField() : parameter;
                errors.add(new ApiFieldError(path, constraintCode(error), error.getDefaultMessage()));
            }
        }
        ApiErrorCode code = onlyQueryParameters
                ? PlatformErrorCode.INVALID_QUERY_PARAMETER
                : PlatformErrorCode.INVALID_REQUEST;
        return render(code, "Request parameters are invalid.", errors, headers, request);
    }

    /**
     * Malformed JSON, unknown fields (fail-on-unknown-properties) and wrong value
     * types.
     */
    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException ex,
            HttpHeaders headers, HttpStatusCode status,
            WebRequest request) {
        List<ApiFieldError> errors = new ArrayList<>();
        JacksonException jackson = findCause(ex, JacksonException.class);
        if (jackson != null && !jackson.getPath().isEmpty()) {
            String code = jackson instanceof UnrecognizedPropertyException ? "UNKNOWN_FIELD" : "INVALID_VALUE";
            String message = jackson instanceof UnrecognizedPropertyException
                    ? "Field is not allowed."
                    : "Value has an invalid type or format.";
            errors.add(new ApiFieldError(jsonPath(jackson.getPath()), code, message));
        }
        return render(PlatformErrorCode.INVALID_REQUEST, "Request body is not valid JSON for this operation.",
                errors, headers, request);
    }

    /**
     * API version errors from Spring MVC native versioning, plus any other
     * ErrorResponseException.
     */
    @Override
    protected ResponseEntity<Object> handleErrorResponseException(ErrorResponseException ex, HttpHeaders headers,
            HttpStatusCode status, WebRequest request) {
        if (ex instanceof InvalidApiVersionException) {
            return render(PlatformErrorCode.INVALID_API_VERSION, "The requested API version is not supported.",
                    List.of(), headers, request);
        }
        if (ex instanceof MissingApiVersionException) {
            return render(PlatformErrorCode.MISSING_API_VERSION, "The API version is missing.", List.of(),
                    headers, request);
        }
        return super.handleErrorResponseException(ex, headers, status, request);
    }

    /**
     * Remaining Spring MVC exceptions (404, 405, 406, 413, 415, ...): code by
     * exception type.
     */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, @Nullable Object body,
            HttpHeaders headers, HttpStatusCode statusCode,
            WebRequest request) {
        if (statusCode.is5xxServerError()) {
            log.error("Request failed with {}", statusCode.value(), ex);
        }
        String detail = body instanceof ProblemDetail problem && problem.getDetail() != null
                ? problem.getDetail()
                : fallbackCode(ex, statusCode).title() + ".";
        return render(fallbackCode(ex, statusCode), detail, List.of(), headers, request);
    }

    static PlatformErrorCode fallbackCode(Exception ex, HttpStatusCode status) {
        if (ex instanceof NoResourceFoundException || ex instanceof NoHandlerFoundException) {
            return PlatformErrorCode.RESOURCE_NOT_FOUND;
        }
        if (ex instanceof HttpRequestMethodNotSupportedException) {
            return PlatformErrorCode.METHOD_NOT_ALLOWED;
        }
        if (ex instanceof HttpMediaTypeNotAcceptableException) {
            return PlatformErrorCode.NOT_ACCEPTABLE;
        }
        if (ex instanceof HttpMediaTypeNotSupportedException) {
            return PlatformErrorCode.UNSUPPORTED_MEDIA_TYPE;
        }
        if (ex instanceof MaxUploadSizeExceededException) {
            return PlatformErrorCode.PAYLOAD_TOO_LARGE;
        }
        return status.is5xxServerError() ? PlatformErrorCode.INTERNAL_ERROR : PlatformErrorCode.INVALID_REQUEST;
    }

    // ---- Rendering
    // --------------------------------------------------------------------------------------

    private ResponseEntity<Object> render(ApiException ex, HttpHeaders headers, WebRequest request) {
        if (ex.getErrorCode().status().is5xxServerError()) {
            log.warn("Request failed with {}: {}", ex.getErrorCode().name(), ex.getMessage(), ex);
        }
        ProblemDetail body = ProblemDetails.of(ex.getErrorCode(), ex.getMessage(), ex.getErrors(), ex.getContext(),
                servletRequest(request));
        return respond(body, ex.getErrorCode(), headers);
    }

    private ResponseEntity<Object> render(ApiErrorCode code, String detail, List<ApiFieldError> errors,
            HttpHeaders headers, WebRequest request) {
        ProblemDetail body = ProblemDetails.of(code, detail, errors, Map.of(), servletRequest(request));
        return respond(body, code, headers);
    }

    private static ResponseEntity<Object> respond(ProblemDetail body, ApiErrorCode code, HttpHeaders headers) {
        HttpHeaders responseHeaders = new HttpHeaders();
        responseHeaders.putAll(headers);
        responseHeaders.setCacheControl(CacheControl.noStore());
        return new ResponseEntity<>(body, responseHeaders, code.status());
    }

    private static HttpServletRequest servletRequest(WebRequest request) {
        return ((NativeWebRequest) request).getNativeRequest(HttpServletRequest.class);
    }

    private static <T extends Throwable> @Nullable T findCause(Throwable ex, Class<T> type) {
        for (Throwable current = ex; current != null; current = current.getCause()) {
            if (type.isInstance(current)) {
                return type.cast(current);
            }
            if (current.getCause() == current) {
                break;
            }
        }
        return null;
    }

    /** Builds {@code content.skills[1].name} from Jackson's reference chain. */
    static String jsonPath(List<JacksonException.Reference> references) {
        StringBuilder path = new StringBuilder();
        for (JacksonException.Reference reference : references) {
            if (reference.getPropertyName() != null) {
                if (!path.isEmpty()) {
                    path.append('.');
                }
                path.append(reference.getPropertyName());
            } else if (reference.getIndex() >= 0) {
                path.append('[').append(reference.getIndex()).append(']');
            }
        }
        return path.toString();
    }

    /**
     * Converts a Bean Validation constraint name such as {@code NotBlank} into
     * {@code NOT_BLANK}.
     */
    static String constraintCode(MessageSourceResolvable error) {
        String[] codes = error.getCodes();
        String simple = (codes == null || codes.length == 0) ? "Invalid" : codes[codes.length - 1];
        return simple.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toUpperCase();
    }
}
