package com.wikiaov.platform.internal.web;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.platform.ApiErrorCode;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.RequestIds;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.format.support.DefaultFormattingConversionService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.http.converter.json.ProblemDetailJacksonMixin;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

/** Error contract: stable code per situation, enum title, errors[], context, request id and no-store. */
class ProblemDetailsExceptionHandlerTest {

    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new ProbeController())
            .setControllerAdvice(new ProblemDetailsExceptionHandler())
            .setConversionService(conversionService())
            .setMessageConverters(new JacksonJsonHttpMessageConverter(JsonMapper.builder()
                    // Same settings as the application: unknown fields rejected, ProblemDetail flattened.
                    .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                    .addMixIn(ProblemDetail.class, ProblemDetailJacksonMixin.class)
                    .build()))
            .addFilters(new RequestIdFilter())
            .build();

    @Test
    void apiExceptionKeepsCodeTitleErrorsAndContext() throws Exception {
        expectProblem(mvc.perform(get("/probe/conflict")), 409, "PROBE_VERSION_CONFLICT")
                .andExpect(jsonPath("$.title").value("Probe version conflict"))
                .andExpect(jsonPath("$.detail").value("The draft has changed."))
                .andExpect(jsonPath("$.context.currentVersion").value(9));
    }

    @Test
    void converterApiExceptionIsUnwrapped() throws Exception {
        expectProblem(mvc.perform(get("/probe/heroes").param("region", "XX")), 400, "PROBE_UNSUPPORTED_REGION")
                .andExpect(jsonPath("$.detail").value("Region 'XX' is not supported."));
    }

    @Test
    void missingOrMalformedQueryParameterIsInvalidQueryParameter() throws Exception {
        expectProblem(mvc.perform(get("/probe/heroes")), 400, "INVALID_QUERY_PARAMETER")
                .andExpect(jsonPath("$.title").value("Invalid query parameter"))
                .andExpect(jsonPath("$.errors[0].path").value("region"))
                .andExpect(jsonPath("$.errors[0].code").value("REQUIRED"));
        expectProblem(mvc.perform(get("/probe/page").param("page", "abc")), 400, "INVALID_QUERY_PARAMETER")
                .andExpect(jsonPath("$.errors[0].path").value("page"));
    }

    @Test
    void queryParameterConstraintIsInvalidQueryParameter() throws Exception {
        expectProblem(mvc.perform(get("/probe/page").param("page", "-1")), 400, "INVALID_QUERY_PARAMETER")
                .andExpect(jsonPath("$.errors[0].path").value("page"))
                .andExpect(jsonPath("$.errors[0].code").value("MIN"));
    }

    @Test
    void malformedPathVariableIsInvalidRequest() throws Exception {
        expectProblem(mvc.perform(get("/probe/heroes/not-a-uuid")), 400, "INVALID_REQUEST")
                .andExpect(jsonPath("$.errors[0].path").value("heroId"));
    }

    @Test
    void bodyValidationListsEveryViolation() throws Exception {
        expectProblem(postJson("{\"code\":\"\",\"size\":0}"), 400, "INVALID_REQUEST")
                .andExpect(jsonPath("$.errors[?(@.path == 'code')].code").value(hasItem("NOT_BLANK")))
                .andExpect(jsonPath("$.errors[?(@.path == 'size')].code").value(hasItem("MIN")));
    }

    @Test
    void unknownJsonFieldIsRejectedWithItsPath() throws Exception {
        expectProblem(postJson("{\"code\":\"a\",\"size\":1,\"extra\":true}"), 400, "INVALID_REQUEST")
                .andExpect(jsonPath("$.errors[0].path").value("extra"))
                .andExpect(jsonPath("$.errors[0].code").value("UNKNOWN_FIELD"));
    }

    @Test
    void wrongJsonTypeAndMalformedJsonAreInvalidRequest() throws Exception {
        expectProblem(postJson("{\"code\":\"a\",\"size\":\"big\"}"), 400, "INVALID_REQUEST")
                .andExpect(jsonPath("$.errors[0].path").value("size"))
                .andExpect(jsonPath("$.errors[0].code").value("INVALID_VALUE"));
        expectProblem(postJson("{not json"), 400, "INVALID_REQUEST");
    }

    @Test
    void transportErrorsHaveTheirOwnCodes() throws Exception {
        expectProblem(mvc.perform(post("/probe/body").contentType(MediaType.TEXT_PLAIN).content("x")),
                415, "UNSUPPORTED_MEDIA_TYPE");
        expectProblem(mvc.perform(put("/probe/body")), 405, "METHOD_NOT_ALLOWED")
                .andExpect(header().exists(HttpHeaders.ALLOW));
        expectProblem(mvc.perform(get("/does-not-exist")), 404, "RESOURCE_NOT_FOUND");
    }

    @Test
    void accessDeniedInsideMvcIsForbiddenNotInternalError() throws Exception {
        expectProblem(mvc.perform(get("/probe/denied")), 403, "FORBIDDEN");
    }

    @Test
    void unexpectedErrorHidesInternalDetails() throws Exception {
        expectProblem(mvc.perform(get("/probe/boom")), 500, "INTERNAL_ERROR")
                .andExpect(jsonPath("$.detail").value(not(containsString("jdbc"))));
    }

    private ResultActions postJson(String json) throws Exception {
        return mvc.perform(post("/probe/body").contentType(MediaType.APPLICATION_JSON).content(json));
    }

    /** Every error: status, problem+json, stable code, request id matching the header, no-store. */
    private static ResultActions expectProblem(ResultActions result, int status, String code) throws Exception {
        String requestId = result.andReturn().getResponse().getHeader(RequestIds.HEADER);
        return result.andExpect(status().is(status))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.status").value(status))
                .andExpect(jsonPath("$.requestId").value(requestId))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));
    }

    private static DefaultFormattingConversionService conversionService() {
        DefaultFormattingConversionService conversion = new DefaultFormattingConversionService();
        conversion.addConverter(String.class, Region.class, value -> {
            try {
                return Region.valueOf(value);
            } catch (IllegalArgumentException ex) {
                throw new ApiException(ProbeErrorCode.PROBE_UNSUPPORTED_REGION,
                        "Region '" + value + "' is not supported.");
            }
        });
        return conversion;
    }

    enum Region {
        VN,
        TH
    }

    enum ProbeErrorCode implements ApiErrorCode {
        PROBE_VERSION_CONFLICT(HttpStatus.CONFLICT, "Probe version conflict"),
        PROBE_UNSUPPORTED_REGION(HttpStatus.BAD_REQUEST, "Unsupported region");

        private final HttpStatus status;
        private final String title;

        ProbeErrorCode(HttpStatus status, String title) {
            this.status = status;
            this.title = title;
        }

        @Override
        public HttpStatus status() {
            return status;
        }

        @Override
        public String title() {
            return title;
        }
    }

    record Payload(@NotBlank String code, @Min(1) int size) {
    }

    @RestController
    @RequestMapping("/probe")
    static class ProbeController {

        @GetMapping("/conflict")
        void conflict() {
            throw new ApiException(ProbeErrorCode.PROBE_VERSION_CONFLICT, "The draft has changed.",
                    List.of(), Map.of("currentVersion", 9), null);
        }

        @GetMapping("/heroes")
        String heroes(@RequestParam Region region) {
            return region.name();
        }

        @GetMapping("/heroes/{heroId}")
        String hero(@PathVariable UUID heroId) {
            return heroId.toString();
        }

        @GetMapping("/page")
        int page(@RequestParam @Min(0) int page) {
            return page;
        }

        @PostMapping("/body")
        void body(@Valid @RequestBody Payload payload) {
        }

        @GetMapping("/denied")
        void denied() {
            throw new AccessDeniedException("denied");
        }

        @GetMapping("/boom")
        void boom() {
            throw new IllegalStateException("jdbc:postgresql://secret-host/wiki failed");
        }
    }
}
