package com.wikiaov.platform;

import java.util.List;
import java.util.Map;
import lombok.Getter;

/**
 * Expected error carrying a stable {@link ApiErrorCode}.
 *
 * <p>Modules throw it with their own code enum from the application or web layer; platform renders it as
 * {@code application/problem+json} without knowing module-specific exceptions. The message becomes
 * {@code detail}: a human-readable fallback that must not leak internal data (SQL, keys, paths).
 */
@Getter
public class ApiException extends RuntimeException {

    private final ApiErrorCode errorCode;
    private final List<ApiFieldError> errors;
    /** Structured hints for clients, e.g. {@code currentVersion}, {@code existingDraftId}. */
    private final Map<String, Object> context;

    public ApiException(ApiErrorCode errorCode, String detail) {
        this(errorCode, detail, List.of(), Map.of(), null);
    }

    public ApiException(ApiErrorCode errorCode, String detail, List<ApiFieldError> errors) {
        this(errorCode, detail, errors, Map.of(), null);
    }

    public ApiException(ApiErrorCode errorCode, String detail, Map<String, ?> context) {
        this(errorCode, detail, List.of(), context, null);
    }

    public ApiException(ApiErrorCode errorCode, String detail, Throwable cause) {
        this(errorCode, detail, List.of(), Map.of(), cause);
    }

    public ApiException(ApiErrorCode errorCode, String detail, List<ApiFieldError> errors,
            Map<String, ?> context, Throwable cause) {
        super(detail, cause);
        this.errorCode = errorCode;
        this.errors = List.copyOf(errors);
        this.context = Map.copyOf(context);
    }
}
