package com.wikiaov.platform.internal.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.platform.PlatformErrorCode;
import com.wikiaov.platform.RequestIds;
import jakarta.servlet.RequestDispatcher;
import org.junit.jupiter.api.Test;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

class ProblemErrorControllerTest {

    private final ProblemErrorController controller = new ProblemErrorController();

    @Test
    void filterFailureBecomesInternalErrorProblem() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/error");
        request.setAttribute(RequestDispatcher.ERROR_STATUS_CODE, 500);
        request.setAttribute(RequestDispatcher.ERROR_EXCEPTION, new IllegalStateException("issuer unreachable"));
        request.setAttribute(RequestDispatcher.ERROR_REQUEST_URI, "/api/wiki/v1/admin/heroes");
        request.setAttribute(RequestIds.ATTRIBUTE, "6f1c2c1e-0000-4000-8000-000000000001");

        ResponseEntity<ProblemDetail> response = controller.error(request);

        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        ProblemDetail body = response.getBody();
        assertThat(body.getProperties()).containsEntry("code", "INTERNAL_ERROR")
                .containsEntry("requestId", "6f1c2c1e-0000-4000-8000-000000000001");
        assertThat(body.getInstance()).hasToString("/api/wiki/v1/admin/heroes");
        assertThat(body.getDetail()).doesNotContain("issuer");
    }

    @Test
    void statusIsMappedToPlatformCode() {
        assertThat(ProblemErrorController.codeFor(404)).isEqualTo(PlatformErrorCode.RESOURCE_NOT_FOUND);
        assertThat(ProblemErrorController.codeFor(400)).isEqualTo(PlatformErrorCode.INVALID_REQUEST);
        assertThat(ProblemErrorController.codeFor(null)).isEqualTo(PlatformErrorCode.INTERNAL_ERROR);
    }
}
