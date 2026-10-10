package com.wikiaov.platform.internal.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.platform.RequestIds;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestIdFilterTest {

    private final RequestIdFilter filter = new RequestIdFilter();

    @Test
    void generatesIdAndIgnoresClientValue() throws Exception {
        String clientValue = UUID.randomUUID().toString();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/wiki/v1/heroes");
        request.addHeader(RequestIds.HEADER, clientValue);
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<String> attribute = new AtomicReference<>();
        AtomicReference<UUID> mdc = new AtomicReference<>();

        filter.doFilter(request, response, (req, res) -> {
            attribute.set(RequestIds.current(request));
            mdc.set(RequestIds.current().orElseThrow());
        });

        String returned = response.getHeader(RequestIds.HEADER);
        assertThat(returned).isNotEqualTo(clientValue).isEqualTo(attribute.get()).isEqualTo(mdc.get().toString());
        assertThat(MDC.get(RequestIds.MDC_KEY)).isNull();
    }
}
