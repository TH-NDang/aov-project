package com.wikiaov.community.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class QueryParametersTest {
    @Test
    void anUnknownParameterIsAnInvalidQueryParameter() {
        var request = new MockHttpServletRequest();
        request.addParameter("regoin", "VN");

        var error = catchThrowableOfType(ApiException.class,
                () -> QueryParameters.requireOnly(request, Set.of("region")));

        assertThat(error.getErrorCode()).isEqualTo(PlatformErrorCode.INVALID_QUERY_PARAMETER);
        assertThat(error.getErrors().getFirst().code()).isEqualTo("UNKNOWN_PARAMETER");
    }

    @Test
    void aRepeatedParameterIsRefused() {
        var request = new MockHttpServletRequest();
        request.addParameter("page", "1", "2");

        var error = catchThrowableOfType(ApiException.class,
                () -> QueryParameters.requireOnly(request, Set.of("page")));

        assertThat(error.getErrors().getFirst().code()).isEqualTo("REPEATED_PARAMETER");
    }

    @Test
    void aRepeatableListMayBeSentOncePerValue() {
        var request = new MockHttpServletRequest();
        request.addParameter("on", "2026-01-01", "2026-01-02");

        assertThatCode(() -> QueryParameters.requireOnly(request, Set.of(), Set.of("on"))).doesNotThrowAnyException();
    }
}
