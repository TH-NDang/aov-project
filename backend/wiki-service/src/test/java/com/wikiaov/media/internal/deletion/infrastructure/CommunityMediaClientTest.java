package com.wikiaov.media.internal.deletion.infrastructure;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.platform.ApiException;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class CommunityMediaClientTest {
    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void checksUsageAndRetiresThroughTheOwningServiceWithTheCallerToken() {
        var id = UUID.randomUUID();
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var client = new CommunityMediaClient(CloudflareMediaCacheTest.config(false), builder);
        authenticate();
        server.expect(requestTo("http://localhost:8082/api/community/v1/admin/media-assets/" + id + "/usage"))
                .andExpect(header("Authorization", "Bearer test-community-token"))
                .andRespond(withSuccess("{\"assetId\":\"" + id + "\",\"references\":0,\"retired\":false}",
                        MediaType.APPLICATION_JSON));
        server.expect(requestTo("http://localhost:8082/api/community/v1/admin/media-assets/" + id + "/retire"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"assetId\":\"" + id + "\",\"references\":0,\"retired\":true}",
                        MediaType.APPLICATION_JSON));
        client.requireUnused(id);
        client.retire(id);
        server.verify();
    }

    @Test
    void failsClosedWhenTheUsageCheckIsUnavailableOrMalformed() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var client = new CommunityMediaClient(CloudflareMediaCacheTest.config(false), builder);
        var id = UUID.randomUUID();
        authenticate();
        server.expect(anything()).andRespond(withServerError());
        server.expect(anything()).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        for (int index = 0; index < 2; index++) {
            assertThatThrownBy(() -> client.requireUnused(id)).isInstanceOfSatisfying(ApiException.class,
                    error -> assertThat(error.getErrorCode()).isEqualTo(MediaErrorCode.MEDIA_COMPETITION_CHECK_FAILED));
        }
        server.verify();
    }

    private static void authenticate() {
        SecurityContextHolder.getContext()
                .setAuthentication(new JwtAuthenticationToken(Jwt.withTokenValue("test-community-token")
                        .header("alg", "none").subject("editor").build()));
    }
}
