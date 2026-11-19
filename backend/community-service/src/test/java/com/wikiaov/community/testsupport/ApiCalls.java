package com.wikiaov.community.testsupport;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Arrays;
import org.jspecify.annotations.Nullable;
import org.springframework.http.MediaType;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Sends JSON requests as a test account and reads the JSON answer. */
public final class ApiCalls {
    public static final String ROOT = "/api/community/v1";
    public static final String ADMIN = ROOT + "/admin";
    /** The issuer of every test account. */
    public static final String ISSUER = "https://identity.example";

    private final MockMvc mvc;
    private final JsonMapper json;

    public ApiCalls(MockMvc mvc, JsonMapper json) {
        this.mvc = mvc;
        this.json = json;
    }

    /** Signs the request in as a person named {@code account}, holding the given capabilities. */
    public static MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder request, String account,
            String... capabilities) {
        GrantedAuthority[] authorities = Arrays.stream(capabilities).map(SimpleGrantedAuthority::new)
                .toArray(GrantedAuthority[]::new);
        return request.with(jwt().jwt(token -> token.subject(account).issuer(ISSUER).claim("name", account))
                .authorities(authorities));
    }

    /** Sends {@code body} as JSON, expects {@code status} and returns the answer, or a null node when it is empty. */
    public JsonNode send(MockHttpServletRequestBuilder request, @Nullable Object body, int status) throws Exception {
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }

        String answer = mvc.perform(request).andExpect(status().is(status)).andReturn().getResponse()
                .getContentAsString();
        return json.readTree(answer.isEmpty() ? "null" : answer);
    }
}
