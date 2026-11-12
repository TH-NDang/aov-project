package com.wikiaov.user.internal.account.application;

import com.wikiaov.access.Actor;
import com.wikiaov.platform.ApiException;
import com.wikiaov.user.internal.account.application.port.AccountMail;
import com.wikiaov.user.internal.account.application.port.CallerSession;
import com.wikiaov.user.internal.account.application.port.IdentityAccounts;
import com.wikiaov.user.internal.account.application.response.SecurityOverview;
import com.wikiaov.user.internal.account.application.response.SessionList;
import com.wikiaov.user.internal.application.UserErrorCode;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Account security state and sessions of the caller (ADR-028). The identity provider owns every credential and
 * session; this facade only reads them and ends sessions that belong to the caller. No database transaction is held
 * while the provider is called.
 */
@Service
public class AccountSecurity {
    private static final Comparator<Instant> NEWEST_FIRST = Comparator.nullsLast(Comparator.reverseOrder());
    private final AccountCaller caller;
    private final IdentityAccounts identity;
    private final CallerSession session;
    private final AccountMail mail;

    public AccountSecurity(AccountCaller caller, IdentityAccounts identity, CallerSession session, AccountMail mail) {
        this.caller = caller;
        this.identity = identity;
        this.session = session;
        this.mail = mail;
    }

    public SecurityOverview overview() {
        Actor actor = caller.human();
        var account = identity.account(actor.subject());

        boolean hasEmail = account.email() != null && !account.email().isBlank();
        var password = new SecurityOverview.Password(account.password() != null,
                account.password() == null ? null : account.password().updatedAt());
        return new SecurityOverview(account.email(), account.emailVerified(), password, hasEmail && mail.available(),
                twoFactor(account));
    }

    public SessionList sessions() {
        Actor actor = caller.human();
        Optional<String> current = session.sessionId();
        var sessions = identity.sessions(actor.subject());
        var devices = identity.devices(session.accessToken());

        var views = sessions.stream()
                .map(row -> view(row, current, devices.orElse(Map.of())))
                .sorted(Comparator.comparing(SessionList.Session::current).reversed()
                        .thenComparing(SessionList.Session::lastAccessAt, NEWEST_FIRST))
                .toList();
        return new SessionList(views, devices.isPresent());
    }

    public void signOut(String sessionId) {
        Actor actor = caller.human();
        if (session.sessionId().filter(sessionId::equals).isPresent())
            throw new ApiException(UserErrorCode.USER_SESSION_CURRENT,
                    "Use the application's sign-out to end the current session.");
        boolean owned = identity.sessions(actor.subject()).stream().anyMatch(row -> row.id().equals(sessionId));
        if (!owned)
            throw new ApiException(UserErrorCode.USER_SESSION_NOT_FOUND, "The session was not found.");

        identity.signOut(sessionId);
        caller.record(actor, "USER_SESSION_SIGNED_OUT", Map.of("sessions", 1));
    }

    /** Ends every session except the caller's; without a session claim, every session ends. */
    public SessionList.SignOutResult signOutOthers() {
        Actor actor = caller.human();
        var others = otherSessionIds(actor);

        others.forEach(identity::signOut);
        caller.record(actor, "USER_OTHER_SESSIONS_SIGNED_OUT", Map.of("sessions", others.size()));
        return new SessionList.SignOutResult(others.size());
    }

    /** Removes recovery codes left behind after the authenticator was removed in the identity provider. */
    public void removeRecoveryCodes() {
        Actor actor = caller.human();
        var account = identity.account(actor.subject());
        if (!account.otp().isEmpty())
            throw new ApiException(UserErrorCode.USER_TWO_FACTOR_ACTIVE,
                    "Recovery codes stay while an authenticator app is configured.");
        if (account.recoveryCodes() == null)
            return;

        identity.removeCredential(actor.subject(), account.recoveryCodes().id());
        caller.record(actor, "USER_RECOVERY_CODES_REMOVED", Map.of());
    }

    private static SecurityOverview.TwoFactor twoFactor(IdentityAccounts.Account account) {
        var codes = account.recoveryCodes() == null
                ? null
                : new SecurityOverview.RecoveryCodes(account.recoveryCodes().id(), account.recoveryCodes().remaining(),
                        account.recoveryCodes().total(), account.recoveryCodes().createdAt());
        var first = account.otp().stream()
                .min(Comparator.comparing(IdentityAccounts.Otp::createdAt,
                        Comparator.nullsLast(Comparator.naturalOrder())));
        return first.map(otp -> new SecurityOverview.TwoFactor(true, otp.id(), otp.label(), otp.createdAt(), codes))
                .orElseGet(() -> new SecurityOverview.TwoFactor(false, null, null, null, codes));
    }

    private static SessionList.Session view(IdentityAccounts.Session row, Optional<String> current,
            Map<String, IdentityAccounts.Device> devices) {
        var device = devices.get(row.id());
        return new SessionList.Session(row.id(), current.filter(row.id()::equals).isPresent(), row.ipAddress(),
                row.startedAt(), row.lastAccessAt(), row.clients().stream().filter(Objects::nonNull).sorted().toList(),
                device == null
                        ? null
                        : new SessionList.Device(device.browser(), device.os(), device.osVersion(), device.device(),
                                device.mobile()));
    }

    private List<String> otherSessionIds(Actor actor) {
        Optional<String> current = session.sessionId();
        return identity.sessions(actor.subject()).stream().map(IdentityAccounts.Session::id)
                .filter(id -> current.filter(id::equals).isEmpty()).toList();
    }
}
