package com.wikiaov.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class QueryParametersTest {

    private static final Set<String> ALLOWED = Set.of("region", "page");

    @Test
    void acceptsKnownParametersOnce() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addParameter("region", "VN");
        assertThatCode(() -> QueryParameters.requireOnly(request, ALLOWED)).doesNotThrowAnyException();
    }

    @Test
    void rejectsUnknownParameter() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addParameter("regoin", "VN");
        assertThatThrownBy(() -> QueryParameters.requireOnly(request, ALLOWED))
                .isInstanceOfSatisfying(ApiException.class, ex -> {
                    assertThat(ex.getErrorCode()).isEqualTo(PlatformErrorCode.INVALID_QUERY_PARAMETER);
                    assertThat(ex.getErrors()).extracting(ApiFieldError::code).containsExactly("UNKNOWN_PARAMETER");
                });
    }

    @Test
    void rejectsRepeatedParameter() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addParameter("page", "1", "2");
        assertThatThrownBy(() -> QueryParameters.requireOnly(request, ALLOWED))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrors()).extracting(ApiFieldError::code)
                                .containsExactly("REPEATED_PARAMETER"));
    }

    @Test
    void pageSliceComputesTotalPages() {
        assertThat(new PageSlice<>(java.util.List.of(), 0, 20, 0).totalPages()).isZero();
        assertThat(new PageSlice<>(java.util.List.of("a"), 0, 20, 41).totalPages()).isEqualTo(3);
    }
}
