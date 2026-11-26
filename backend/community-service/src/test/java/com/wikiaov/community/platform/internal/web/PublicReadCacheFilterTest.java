package com.wikiaov.community.platform.internal.web;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class PublicReadCacheFilterTest {
    private final PublicReadCacheFilter filter = new PublicReadCacheFilter();

    private MockHttpServletResponse get(String path, String tag) throws Exception {
        var request = new MockHttpServletRequest("GET", path);
        if (tag != null) {
            request.addHeader("If-None-Match", tag);
        }
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain(new jakarta.servlet.http.HttpServlet() {
            @Override
            protected void service(jakarta.servlet.http.HttpServletRequest req, HttpServletResponse res)
                    throws java.io.IOException {
                res.setContentType("application/json");
                res.getOutputStream().write("{\"items\":[]}".getBytes(StandardCharsets.UTF_8));
            }
        }));
        return response;
    }

    @Test
    void aPublishedCompetitionListIsKeptForAMinuteAndTagged() throws Exception {
        var response = get("/api/community/v1/competitions", null);

        assertThat(response.getHeader("Cache-Control")).isEqualTo("max-age=60, must-revalidate, public");
        assertThat(response.getHeader("ETag")).isNotBlank();
        assertThat(response.getContentAsString()).isEqualTo("{\"items\":[]}");
    }

    @Test
    void theSameAnswerComesBackAsNotModifiedForItsTag() throws Exception {
        var tag = get("/api/community/v1/competitions/participants", null).getHeader("ETag");

        var again = get("/api/community/v1/competitions/participants", tag);

        assertThat(again.getStatus()).isEqualTo(304);
        assertThat(again.getContentAsByteArray()).isEmpty();
    }

    @Test
    void anErrorKeepsTheCacheControlItsHandlerSet() throws Exception {
        var request = new MockHttpServletRequest("GET",
                "/api/community/v1/competitions/1b4e28ba-2fa1-11d2-883f-0016d3cca427");
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain(new jakarta.servlet.http.HttpServlet() {
            @Override
            protected void service(jakarta.servlet.http.HttpServletRequest req, HttpServletResponse res) {
                res.setStatus(404);
                res.setHeader("Cache-Control", "no-store");
            }
        }));

        assertThat(response.getHeaders("Cache-Control")).containsExactly("no-store");
        assertThat(response.getHeader("ETag")).isNull();
    }

    @Test
    void readsOutsideThePublicCompetitionsAreLeftAlone() throws Exception {
        var admin = get("/api/community/v1/admin/competitions", null);
        var statistics = get("/api/community/v1/competitions/1b4e28ba-2fa1-11d2-883f-0016d3cca427/statistics", null);

        assertThat(admin.getHeader("Cache-Control")).isNull();
        assertThat(admin.getHeader("ETag")).isNull();
        assertThat(statistics.getHeader("Cache-Control")).isNull();
    }
}
