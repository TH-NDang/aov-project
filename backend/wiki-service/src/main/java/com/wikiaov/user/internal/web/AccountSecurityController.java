package com.wikiaov.user.internal.web;

import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import com.wikiaov.user.internal.account.application.AccountSecurity;
import com.wikiaov.user.internal.account.application.PasswordChanges;
import com.wikiaov.user.internal.account.application.port.AccountMail;
import com.wikiaov.user.internal.account.application.response.PasswordChallengeView;
import com.wikiaov.user.internal.account.application.response.PasswordChangeResult;
import com.wikiaov.user.internal.account.application.response.SecurityOverview;
import com.wikiaov.user.internal.account.application.response.SessionList;
import com.wikiaov.user.internal.web.request.PasswordChangeRequests;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ROOT + "/users/me/security")
public class AccountSecurityController implements AccountSecurityApi {
    private final AccountSecurity security;
    private final PasswordChanges passwords;

    public AccountSecurityController(AccountSecurity security, PasswordChanges passwords) {
        this.security = security;
        this.passwords = passwords;
    }

    @Override
    @GetMapping(version = "1")
    public SecurityOverview overview(HttpServletRequest http) {
        QueryParameters.requireOnly(http, Set.of());
        return security.overview();
    }

    @Override
    @PostMapping(path = "/password-change", version = "1")
    public ResponseEntity<PasswordChallengeView> startPasswordChange(HttpServletRequest http,
            @RequestBody(required = false) PasswordChangeRequests.Start body) {
        QueryParameters.requireOnly(http, Set.of());
        var language = AccountMail.Language.of(body == null ? null : body.language());
        return ResponseEntity.status(HttpStatus.CREATED).body(passwords.start(language));
    }

    @Override
    @PostMapping(path = "/password-change/{challengeId}/confirm", version = "1")
    public PasswordChangeResult confirmPasswordChange(HttpServletRequest http, @PathVariable UUID challengeId,
            @RequestBody PasswordChangeRequests.Confirm body) {
        QueryParameters.requireOnly(http, Set.of());
        return passwords.confirm(challengeId, body.code(), body.newPassword(),
                !Boolean.FALSE.equals(body.signOutOtherSessions()), AccountMail.Language.of(body.language()));
    }

    @Override
    @GetMapping(path = "/sessions", version = "1")
    public SessionList sessions(HttpServletRequest http) {
        QueryParameters.requireOnly(http, Set.of());
        return security.sessions();
    }

    @Override
    @DeleteMapping(path = "/sessions/{sessionId}", version = "1")
    public ResponseEntity<Void> signOutSession(HttpServletRequest http, @PathVariable String sessionId) {
        QueryParameters.requireOnly(http, Set.of());
        security.signOut(sessionId);
        return ResponseEntity.noContent().build();
    }

    @Override
    @PostMapping(path = "/sessions/sign-out-others", version = "1")
    public SessionList.SignOutResult signOutOtherSessions(HttpServletRequest http) {
        QueryParameters.requireOnly(http, Set.of());
        return security.signOutOthers();
    }

    @Override
    @DeleteMapping(path = "/two-factor/recovery-codes", version = "1")
    public ResponseEntity<Void> removeRecoveryCodes(HttpServletRequest http) {
        QueryParameters.requireOnly(http, Set.of());
        security.removeRecoveryCodes();
        return ResponseEntity.noContent().build();
    }
}
