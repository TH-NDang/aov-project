package com.wikiaov.access.internal.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.wikiaov.platform.ApiException;
import java.time.Clock;
import org.junit.jupiter.api.Test;

class AuthGuardsTest {
    @Test
    void throttleExpiresAndLimitsEachKey() {
        Clock clock = mock(Clock.class);
        when(clock.millis()).thenReturn(1000L);
        var throttle = new AuthThrottle(clock);
        throttle.check("account", 1);
        assertThatThrownBy(() -> throttle.check("account", 1)).isInstanceOf(ApiException.class);
        throttle.check("other", 1);
        when(clock.millis()).thenReturn(61001L);
        throttle.check("account", 1);
    }

    @Test
    void googleStateExpiresAndVerifierIsDistinctFromChallenge() {
        Clock clock = mock(Clock.class);
        when(clock.millis()).thenReturn(1000L);
        var flows = new GoogleLoginFlows(clock);
        var flow = flows.start();
        assertThat(flow.challenge()).hasSize(43).isNotEqualTo(flow.verifier());
        assertThatThrownBy(() -> flows.consume(flow.state(), "wrong-cookie")).isInstanceOf(ApiException.class);
        when(clock.millis()).thenReturn(301001L);
        assertThatThrownBy(() -> flows.consume(flow.state(), flow.binding())).isInstanceOf(ApiException.class);
    }

    @Test
    void secureCookieConfigurationRejectsPlainHttp() {
        assertThatThrownBy(() -> new AuthProperties("http://localhost:5175", "/", "client", "secret", true, false,
                "/api/wiki/v1/auth/google/callback")).isInstanceOf(IllegalArgumentException.class);
    }
}
