package com.wikiaov.community.platform.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.community.platform.ApiErrorCode;
import com.wikiaov.community.platform.ApiException;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@ExtendWith(OutputCaptureExtension.class)
class ProblemDetailsExceptionHandlerTest {
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new FailingController())
            .setControllerAdvice(new ProblemDetailsExceptionHandler()).addFilters(new RequestIdFilter()).build();

    @Test
    void anIllegalArgumentExceptionIsAnsweredAsAnInternalError() throws Exception {
        mvc.perform(get("/illegal-argument")).andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"));
    }

    @Test
    void anUnexpectedErrorIsLogged(CapturedOutput output) throws Exception {
        mvc.perform(get("/illegal-argument"));

        assertThat(output).contains("Unexpected error").contains("a programming mistake");
    }

    @Test
    void anUnexpectedErrorDoesNotRevealItsMessage() throws Exception {
        mvc.perform(get("/illegal-argument"))
                .andExpect(jsonPath("$.detail").value("An unexpected error occurred."));
    }

    @Test
    void aUniqueViolationIsAnsweredAsADuplicate() throws Exception {
        mvc.perform(get("/unique-violation")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TOURNAMENT_DUPLICATE_CODE"));
    }

    @Test
    void anotherIntegrityViolationIsAnsweredAsAnInternalError() throws Exception {
        mvc.perform(get("/foreign-key-violation")).andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"));
    }

    @Test
    void aConcurrentChangeIsAnsweredAsAVersionConflictOfNoModule() throws Exception {
        mvc.perform(get("/optimistic-locking")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
    }

    @Test
    void anApiExceptionKeepsItsCodeStatusAndTopLevelProperties() throws Exception {
        mvc.perform(get("/api-exception")).andExpect(status().is(422))
                .andExpect(jsonPath("$.code").value("EXAMPLE_INVALID"))
                .andExpect(jsonPath("$.usages[0]").value("SERIES"));
    }

    @Test
    void aQueryParameterOfTheWrongTypeIsAnInvalidQueryParameter() throws Exception {
        mvc.perform(get("/typed").param("level", "SOME")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"))
                .andExpect(jsonPath("$.errors[0].path").value("level"));
    }

    @Test
    void anErrorCarriesTheRequestIdOfItsAnswer() throws Exception {
        var answer = mvc.perform(get("/api-exception")).andReturn().getResponse();

        assertThat(answer.getContentAsString()).contains("\"requestId\":\"" + answer.getHeader("X-Request-Id") + "\"");
    }

    @Test
    void anErrorNamesItsTitleAndTheFailedPath() throws Exception {
        mvc.perform(get("/api-exception")).andExpect(jsonPath("$.title").value("Example failed"))
                .andExpect(jsonPath("$.instance").value("/api-exception"));
    }

    @Test
    void errorsAreNeverCached() throws Exception {
        mvc.perform(get("/api-exception")).andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void aMissingCapabilityIsLeftToSpringSecurity() {
        assertThatThrownBy(() -> mvc.perform(get("/access-denied")))
                .hasRootCauseInstanceOf(AccessDeniedException.class);
    }

    enum Level {
        ALL,
        MAIN
    }

    enum ExampleErrorCode implements ApiErrorCode {
        EXAMPLE_INVALID;

        @Override
        public HttpStatus status() {
            return HttpStatus.UNPROCESSABLE_CONTENT;
        }

        @Override
        public String title() {
            return "Example failed";
        }
    }

    @RestController
    static class FailingController {
        @GetMapping("/illegal-argument")
        String illegalArgument() {
            throw new IllegalArgumentException("a programming mistake");
        }

        @GetMapping("/unique-violation")
        String uniqueViolation() {
            throw new DataIntegrityViolationException("duplicate", new SQLException("duplicate key", "23505"));
        }

        @GetMapping("/foreign-key-violation")
        String foreignKeyViolation() {
            throw new DataIntegrityViolationException("missing parent", new SQLException("missing", "23503"));
        }

        @GetMapping("/optimistic-locking")
        String optimisticLocking() {
            throw new ObjectOptimisticLockingFailureException(Object.class, "id");
        }

        @GetMapping("/api-exception")
        String apiException() {
            throw new ApiException(ExampleErrorCode.EXAMPLE_INVALID, "Invalid.",
                    Map.of("usages", List.of("SERIES")));
        }

        @GetMapping("/typed")
        String typed(@RequestParam Level level) {
            return level.name();
        }

        @GetMapping("/access-denied")
        String accessDenied() {
            throw new AccessDeniedException("missing capability");
        }
    }
}
