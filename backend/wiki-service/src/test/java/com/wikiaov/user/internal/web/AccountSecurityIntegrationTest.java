package com.wikiaov.user.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.TestcontainersConfiguration;
import com.wikiaov.platform.ApiException;
import com.wikiaov.user.internal.account.application.port.AccountMail;
import com.wikiaov.user.internal.account.application.port.IdentityAccounts;
import com.wikiaov.user.internal.application.UserErrorCode;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.mail.health.MailHealthIndicator;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Account security over HTTP with real persistence; the identity provider and SMTP are replaced by mocks. */
// A configured SMTP host creates the mail sender, so the test can prove the mail health check stays off.
@SpringBootTest(properties = "spring.mail.host=localhost")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class AccountSecurityIntegrationTest {
    private static final String BASE = "/api/wiki/v1/users/me/security";
    private static final String ISSUER = "https://identity.example";
    @Autowired
    MockMvc mvc;
    @Autowired
    JdbcClient jdbc;
    @Autowired
    ApplicationContext context;
    @MockitoBean
    IdentityAccounts identity;
    @MockitoBean
    AccountMail mail;
    private String subject;

    @BeforeEach
    void account() {
        subject = UUID.randomUUID().toString();
        when(identity.account(anyString())).thenReturn(new IdentityAccounts.Account("reader@example.com", true,
                new IdentityAccounts.Password(Instant.parse("2026-11-01T00:00:00Z")), List.of(), null));
        when(mail.available()).thenReturn(true);
        when(identity.devices(anyString())).thenReturn(Optional.empty());
    }

    private RequestPostProcessor person(String sessionId) {
        return jwt().jwt(token -> token.subject(subject).issuer(ISSUER).claim("sid", sessionId)
                .claim("preferred_username", "reader").tokenValue("caller-token"));
    }

    private String startAndCaptureCode() throws Exception {
        mvc.perform(post(BASE + "/password-change").with(person("s-current")).contentType("application/json")
                .content("{\"language\":\"vi\"}")).andExpect(status().isCreated())
                .andExpect(jsonPath("$.emailHint").value("r•••r@example.com"));
        var code = ArgumentCaptor.forClass(String.class);
        verify(mail, org.mockito.Mockito.atLeastOnce()).sendPasswordCode(eq("reader@example.com"), code.capture(),
                eq(Duration.ofMinutes(10)), eq(AccountMail.Language.VI));
        return code.getValue();
    }

    private UUID latestChallenge() {
        return jdbc.sql("""
                select id from user_profile.password_change_challenge where subject = :subject
                order by created_at desc limit 1
                """).param("subject", subject).query(UUID.class).single();
    }

    private void allowNextCode() {
        jdbc.sql("""
                update user_profile.password_change_challenge
                set created_at = created_at - interval '2 minutes', expires_at = expires_at - interval '2 minutes'
                where subject = :subject
                """).param("subject", subject).update();
    }

    private static String confirm(String code, String password) {
        return "{\"code\":\"" + code + "\",\"newPassword\":\"" + password + "\"}";
    }

    @Test
    void anUnreachableMailServerDoesNotMakeTheServiceUnhealthy() {
        assertThat(context.getBeanNamesForType(JavaMailSenderImpl.class)).isNotEmpty();
        assertThat(context.getBeanNamesForType(MailHealthIndicator.class)).isEmpty();
        assertThat(context.containsBean("mailHealthContributor")).isFalse();
    }

    @Test
    void rejectsAnonymousCallersAndServiceAccounts() throws Exception {
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
        mvc.perform(get(BASE).with(jwt().jwt(token -> token.subject("importer").claim("client_id", "wiki-importer"))))
                .andExpect(status().isForbidden());
        mvc.perform(get(BASE + "?unexpected=1").with(person("s-current"))).andExpect(status().isBadRequest());
    }

    @Test
    void overviewReportsPasswordAndTwoFactorState() throws Exception {
        when(identity.account(subject)).thenReturn(new IdentityAccounts.Account("reader@example.com", false, null,
                List.of(new IdentityAccounts.Otp("otp-2", "Tablet", Instant.parse("2026-11-03T00:00:00Z")),
                        new IdentityAccounts.Otp("otp-1", "Phone", Instant.parse("2026-11-02T00:00:00Z"))),
                new IdentityAccounts.RecoveryCodes("codes", 11, 12, Instant.parse("2026-11-02T00:01:00Z"))));

        mvc.perform(get(BASE).with(person("s-current"))).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.email").value("reader@example.com"))
                .andExpect(jsonPath("$.emailVerified").value(false))
                .andExpect(jsonPath("$.password.set").value(false))
                .andExpect(jsonPath("$.passwordChangeAvailable").value(true))
                .andExpect(jsonPath("$.twoFactor.enabled").value(true))
                .andExpect(jsonPath("$.twoFactor.credentialId").value("otp-1"))
                .andExpect(jsonPath("$.twoFactor.recoveryCodes.remaining").value(11));
    }

    @Test
    void passwordReachesTheProviderOnlyAfterTheMailedCode() throws Exception {
        String code = startAndCaptureCode();
        UUID challenge = latestChallenge();
        String wrong = code.equals("000000") ? "111111" : "000000";
        when(identity.sessions(subject)).thenReturn(List.of(
                new IdentityAccounts.Session("s-current", null, null, null, List.of("aov-wiki")),
                new IdentityAccounts.Session("s-other", null, null, null, List.of("aov-stream"))));

        mvc.perform(post(BASE + "/password-change/" + challenge + "/confirm").with(person("s-current"))
                .contentType("application/json").content(confirm(wrong, "new-password-1")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("USER_PASSWORD_CODE_INVALID"))
                .andExpect(jsonPath("$.context.attemptsRemaining").value(4));
        verify(identity, never()).setPassword(anyString(), anyString());

        mvc.perform(post(BASE + "/password-change/" + challenge + "/confirm").with(person("s-current"))
                .contentType("application/json").content(confirm(code, "new-password-1")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.otherSessions").value("SIGNED_OUT"))
                .andExpect(jsonPath("$.signedOut").value(1));
        verify(identity).setPassword(subject, "new-password-1");
        verify(identity).signOut("s-other");
        verify(identity, never()).signOut("s-current");
        verify(mail).sendPasswordChanged("reader@example.com", AccountMail.Language.VI);
        assertThat(
                jdbc.sql("select count(*) from access.audit_event where actor_subject = :subject and action = :action")
                        .param("subject", subject).param("action", "USER_PASSWORD_CHANGED").query(Long.class).single())
                .isEqualTo(1);
        assertThat(jdbc.sql("select metadata::text from access.audit_event where actor_subject = :subject")
                .param("subject", subject).query(String.class).list()).noneMatch(
                        text -> text != null
                                && (text.contains("new-password-1") || text.contains(code)));

        mvc.perform(post(BASE + "/password-change/" + challenge + "/confirm").with(person("s-current"))
                .contentType("application/json").content(confirm(code, "new-password-2")))
                .andExpect(status().isGone()).andExpect(jsonPath("$.code").value("USER_PASSWORD_CODE_EXPIRED"));
    }

    @Test
    void keepsOtherSessionsWhenAskedAndRejectsMalformedBodies() throws Exception {
        String code = startAndCaptureCode();
        UUID challenge = latestChallenge();
        for (String body : List.of(confirm("12ab56", "new-password-1"), confirm(code, "short"),
                "{\"code\":\"" + code + "\",\"newPassword\":\"new-password-1\",\"unknown\":1}")) {
            mvc.perform(post(BASE + "/password-change/" + challenge + "/confirm").with(person("s-current"))
                    .contentType("application/json").content(body)).andExpect(status().isBadRequest());
        }

        mvc.perform(post(BASE + "/password-change/" + challenge + "/confirm").with(person("s-current"))
                .contentType("application/json").content("{\"code\":\"" + code
                        + "\",\"newPassword\":\"new-password-1\",\"signOutOtherSessions\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.otherSessions").value("KEPT"));
        verify(identity, never()).signOut(anyString());
    }

    @Test
    void ratesLimitsCodesAndReplacesOlderOnes() throws Exception {
        String first = startAndCaptureCode();
        UUID firstChallenge = latestChallenge();
        mvc.perform(post(BASE + "/password-change").with(person("s-current")))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("USER_PASSWORD_CODE_RATE_LIMITED"))
                .andExpect(jsonPath("$.context.retryAfterSeconds").isNumber());

        allowNextCode();
        startAndCaptureCode();
        assertThat(latestChallenge()).isNotEqualTo(firstChallenge);
        mvc.perform(post(BASE + "/password-change/" + firstChallenge + "/confirm").with(person("s-current"))
                .contentType("application/json").content(confirm(first, "new-password-1")))
                .andExpect(status().isGone());

        for (int index = 0; index < 3; index++) {
            allowNextCode();
            startAndCaptureCode();
        }
        allowNextCode();
        mvc.perform(post(BASE + "/password-change").with(person("s-current")))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void enforcesAttemptsExpiryAndOwnership() throws Exception {
        String code = startAndCaptureCode();
        UUID challenge = latestChallenge();
        String wrong = code.equals("000000") ? "111111" : "000000";
        mvc.perform(post(BASE + "/password-change/" + challenge + "/confirm")
                .with(jwt().jwt(token -> token.subject("someone-else").issuer(ISSUER)))
                .contentType("application/json").content(confirm(code, "new-password-1")))
                .andExpect(status().isNotFound());
        for (int attempt = 4; attempt >= 0; attempt--) {
            mvc.perform(post(BASE + "/password-change/" + challenge + "/confirm").with(person("s-current"))
                    .contentType("application/json").content(confirm(wrong, "new-password-1")))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.context.attemptsRemaining").value(attempt));
        }
        mvc.perform(post(BASE + "/password-change/" + challenge + "/confirm").with(person("s-current"))
                .contentType("application/json").content(confirm(code, "new-password-1")))
                .andExpect(status().isGone());

        allowNextCode();
        String fresh = startAndCaptureCode();
        UUID expiring = latestChallenge();
        jdbc.sql("update user_profile.password_change_challenge set expires_at = now() - interval '1 second', "
                + "created_at = now() - interval '11 minutes' where id = :id").param("id", expiring).update();
        mvc.perform(post(BASE + "/password-change/" + expiring + "/confirm").with(person("s-current"))
                .contentType("application/json").content(confirm(fresh, "new-password-1")))
                .andExpect(status().isGone());
        verify(identity, never()).setPassword(anyString(), anyString());
    }

    @Test
    void policyRejectionKeepsTheCodeUsable() throws Exception {
        String code = startAndCaptureCode();
        UUID challenge = latestChallenge();
        doThrow(new ApiException(UserErrorCode.USER_PASSWORD_REJECTED, "Rejected",
                Map.of("policy", "invalidPasswordMinLengthMessage")))
                .doNothing().when(identity).setPassword(subject, "weak-password");

        mvc.perform(post(BASE + "/password-change/" + challenge + "/confirm").with(person("s-current"))
                .contentType("application/json").content(confirm(code, "weak-password")))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.context.policy").value("invalidPasswordMinLengthMessage"));
        mvc.perform(post(BASE + "/password-change/" + challenge + "/confirm").with(person("s-current"))
                .contentType("application/json").content("{\"code\":\"" + code
                        + "\",\"newPassword\":\"weak-password\",\"signOutOtherSessions\":false}"))
                .andExpect(status().isOk());
    }

    @Test
    void reportsMissingEmailAndMailFailures() throws Exception {
        when(identity.account(subject)).thenReturn(new IdentityAccounts.Account(null, false, null, List.of(), null));
        mvc.perform(post(BASE + "/password-change").with(person("s-current")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("USER_EMAIL_MISSING"));

        when(identity.account(subject)).thenReturn(new IdentityAccounts.Account("reader@example.com", true, null,
                List.of(), null));
        doThrow(new ApiException(UserErrorCode.USER_MAIL_UNAVAILABLE, "Down")).when(mail)
                .sendPasswordCode(anyString(), anyString(), any(), any());
        mvc.perform(post(BASE + "/password-change").with(person("s-current")))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("USER_MAIL_UNAVAILABLE"));
        assertThat(jdbc.sql("select status from user_profile.password_change_challenge where subject = :subject")
                .param("subject", subject).query(String.class).list()).containsExactly("FAILED");

        when(mail.available()).thenReturn(false);
        mvc.perform(get(BASE).with(person("s-current"))).andExpect(jsonPath("$.passwordChangeAvailable").value(false));
    }

    @Test
    void sessionsMarkAndProtectTheCurrentSession() throws Exception {
        when(identity.sessions(subject)).thenReturn(List.of(
                new IdentityAccounts.Session("s-other", "203.0.113.20", Instant.parse("2026-11-08T00:00:00Z"),
                        Instant.parse("2026-11-09T02:00:00Z"), List.of("aov-stream")),
                new IdentityAccounts.Session("s-current", "203.0.113.10", Instant.parse("2026-11-09T00:00:00Z"),
                        Instant.parse("2026-11-09T01:00:00Z"), List.of("aov-wiki"))));
        when(identity.devices("caller-token")).thenReturn(Optional.of(Map.of("s-current",
                new IdentityAccounts.Device("Chrome/130.0", "Windows", "10", "Other", false))));

        mvc.perform(get(BASE + "/sessions").with(person("s-current"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.deviceDetails").value(true))
                .andExpect(jsonPath("$.sessions[0].id").value("s-current"))
                .andExpect(jsonPath("$.sessions[0].current").value(true))
                .andExpect(jsonPath("$.sessions[0].device.browser").value("Chrome/130.0"))
                .andExpect(jsonPath("$.sessions[1].device").isEmpty())
                .andExpect(jsonPath("$.sessions[1].applications[0]").value("aov-stream"));

        mvc.perform(delete(BASE + "/sessions/s-current").with(person("s-current")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("USER_SESSION_CURRENT"));
        mvc.perform(delete(BASE + "/sessions/s-unknown").with(person("s-current")))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("USER_SESSION_NOT_FOUND"));
        mvc.perform(delete(BASE + "/sessions/s-other").with(person("s-current"))).andExpect(status().isNoContent());
        verify(identity).signOut("s-other");

        mvc.perform(post(BASE + "/sessions/sign-out-others").with(person("s-current")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.signedOut").value(1));
        verify(identity, never()).signOut("s-current");
    }

    @Test
    void recoveryCodesAreRemovedOnlyAfterTheAuthenticator() throws Exception {
        var codes = new IdentityAccounts.RecoveryCodes("codes", 12, 12, null);
        when(identity.account(subject)).thenReturn(new IdentityAccounts.Account("reader@example.com", true, null,
                List.of(new IdentityAccounts.Otp("otp", null, null)), codes));
        mvc.perform(delete(BASE + "/two-factor/recovery-codes").with(person("s-current")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("USER_TWO_FACTOR_ACTIVE"));
        verify(identity, never()).removeCredential(anyString(), anyString());

        when(identity.account(subject)).thenReturn(new IdentityAccounts.Account("reader@example.com", true, null,
                List.of(), codes));
        mvc.perform(delete(BASE + "/two-factor/recovery-codes").with(person("s-current")))
                .andExpect(status().isNoContent());
        verify(identity).removeCredential(subject, "codes");
    }
}
