package com.wikiaov.access.internal.infrastructure;

import com.wikiaov.platform.ApiErrorCode;
import com.wikiaov.platform.ProblemDetails;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/** Writes ProblemDetail bodies from the security filter chain, which runs before Spring MVC. */
@Component
class ProblemResponseWriter {

    private final JsonMapper jsonMapper;

    ProblemResponseWriter(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    void write(HttpServletRequest request, HttpServletResponse response, ApiErrorCode code, String detail)
            throws IOException {
        ProblemDetail problem = ProblemDetails.of(code, detail, request);
        response.setStatus(code.status().value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setHeader(HttpHeaders.CACHE_CONTROL, CacheControl.noStore().getHeaderValue());
        jsonMapper.writeValue(response.getOutputStream(), flatten(problem));
    }

    /**
     * Puts extension properties at the top level and omits empty members, like the MVC message converter.
     * {@code type} is null by default in Spring 7 (meaning {@code about:blank}), so it must not be dereferenced.
     */
    static Map<String, Object> flatten(ProblemDetail problem) {
        Map<String, Object> body = new LinkedHashMap<>();
        if (problem.getType() != null) {
            body.put("type", problem.getType().toString());
        }
        body.put("title", problem.getTitle());
        body.put("status", problem.getStatus());
        body.put("detail", problem.getDetail());
        if (problem.getInstance() != null) {
            body.put("instance", problem.getInstance().toString());
        }
        if (problem.getProperties() != null) {
            body.putAll(problem.getProperties());
        }
        return body;
    }
}
