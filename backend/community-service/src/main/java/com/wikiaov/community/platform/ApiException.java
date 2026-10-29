package com.wikiaov.community.platform;

import java.util.Map;

public class ApiException extends RuntimeException {
    private final ApiErrorCode code;
    private final Map<String, Object> properties;

    public ApiException(ApiErrorCode code, String detail) {
        this(code, detail, Map.of());
    }

    public ApiException(ApiErrorCode code, String detail, Map<String, Object> properties) {
        super(detail);
        this.code = code;
        this.properties = Map.copyOf(properties);
    }

    public String code() {
        return code.toString();
    }

    public int status() {
        return code.status();
    }

    public Map<String, Object> properties() {
        return properties;
    }
}
