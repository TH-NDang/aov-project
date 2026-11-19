package com.wikiaov.user.internal.account.application;

import static com.wikiaov.user.internal.account.persistence.entity.PasswordChallenge.Status.APPLYING;
import static com.wikiaov.user.internal.account.persistence.entity.PasswordChallenge.Status.FAILED;
import static com.wikiaov.user.internal.account.persistence.entity.PasswordChallenge.Status.PENDING;
import static com.wikiaov.user.internal.account.persistence.entity.PasswordChallenge.Status.SUPERSEDED;
import static com.wikiaov.user.internal.account.persistence.entity.PasswordChallenge.Status.USED;

import com.wikiaov.access.Actor;
import com.wikiaov.platform.ApiException;
import com.wikiaov.user.internal.account.application.port.AccountMail;
import com.wikiaov.user.internal.account.application.port.IdentityAccounts;
import com.wikiaov.user.internal.account.application.response.PasswordChallengeView;
import com.wikiaov.user.internal.account.application.response.PasswordChangeResult;
import com.wikiaov.user.internal.account.domain.EmailHint;
import com.wikiaov.user.internal.account.domain.PasswordCode;
import com.wikiaov.user.internal.account.persistence.PasswordChallengeRepository;
import com.wikiaov.user.internal.account.persistence.entity.PasswordChallenge;
import com.wikiaov.user.internal.application.UserErrorCode;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Password change confirmed by a code mailed to the account (ADR-028).
 *
 * <p>Each step uses short transactions: email and identity-provider calls always happen outside them. The new password
 * goes straight to the identity provider and is never stored, logged or audited.
 */
@Service
@EnableConfigurationProperties(PasswordCodePolicy.class)
public class PasswordChanges {
    private static final Logger log = LoggerFactory.getLogger(PasswordChanges.class);
    private static final Duration RETENTION = Duration.ofDays(1);
    private static final Duration RATE_WINDOW = Duration.ofHours(1);
    private final AccountCaller caller;
    private final IdentityAccounts identity;
    private final AccountMail mail;
    private final AccountSecurity security;
    private final PasswordChallengeRepository challenges;
    private final TransactionTemplate transaction;
    private final PasswordCodePolicy policy;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public PasswordChanges(AccountCaller caller, IdentityAccounts identity, AccountMail mail, AccountSecurity security,
            PasswordChallengeRepository challenges, TransactionTemplate transaction, PasswordCodePolicy policy,
            Clock clock) {
        this.caller = caller;
        this.identity = identity;
        this.mail = mail;
        this.security = security;
        this.challenges = challenges;
        this.transaction = transaction;
        this.policy = policy;
        this.clock = clock;
    }

    public PasswordChallengeView start(AccountMail.Language language) {
        Actor actor = caller.human();
        String email = identity.account(actor.subject()).email();
        if (email == null || email.isBlank()) {
            throw new ApiException(UserErrorCode.USER_EMAIL_MISSING, "The account has no email address.");
        }
        if (!mail.available()) {
            throw new ApiException(UserErrorCode.USER_MAIL_UNAVAILABLE, "Email delivery is not configured.");
        }

        String code = PasswordCode.generate(random);
        PasswordChallenge challenge = Objects.requireNonNull(transaction.execute(status -> create(actor, code)));
        send(challenge.getId(), email, code, language);

        return new PasswordChallengeView(challenge.getId(), EmailHint.mask(email), challenge.getExpiresAt(),
                challenge.getCreatedAt().plus(policy.resendInterval()));
    }

    public PasswordChangeResult confirm(UUID challengeId, String code, String newPassword, boolean signOutOthers,
            AccountMail.Language language) {
        Actor actor = caller.human();
        Verification verification = Objects.requireNonNull(
                transaction.execute(status -> verify(actor, challengeId, code)));
        verification.throwIfRejected();

        apply(actor, challengeId, newPassword);
        PasswordChangeResult result = signOutOthers
                ? signOutOthers()
                : new PasswordChangeResult(
                        PasswordChangeResult.OtherSessions.KEPT, 0);
        notifyChanged(actor, language);
        return result;
    }

    private PasswordChallenge create(Actor actor, String code) {
        Instant now = clock.instant();
        requireWithinRateLimit(actor, now);

        challenges.deleteExpiredBefore(now.minus(RETENTION));
        challenges.supersedePending(actor.issuer(), actor.subject(), now, PENDING, SUPERSEDED);
        UUID id = UUID.randomUUID();
        return challenges.save(new PasswordChallenge(id, actor.issuer(), actor.subject(), PasswordCode.hash(id, code),
                now, now.plus(policy.lifetime())));
    }

    private void requireWithinRateLimit(Actor actor, Instant now) {
        List<Instant> recent = challenges.createdSince(actor.issuer(), actor.subject(), now.minus(RATE_WINDOW),
                Limit.of(policy.hourlyLimit()));
        Instant retryAt = recent.isEmpty() ? now : recent.getFirst().plus(policy.resendInterval());
        if (recent.size() >= policy.hourlyLimit()) {
            Instant slot = recent.getLast().plus(RATE_WINDOW);
            retryAt = slot.isAfter(retryAt) ? slot : retryAt;
        }

        if (retryAt.isAfter(now)) {
            long seconds = Math.max(1, (Duration.between(now, retryAt).toMillis() + 999) / 1000);
            throw new ApiException(UserErrorCode.USER_PASSWORD_CODE_RATE_LIMITED,
                    "Too many codes were requested. Try again later.", Map.of("retryAfterSeconds", seconds));
        }
    }

    private void send(UUID challengeId, String email, String code, AccountMail.Language language) {
        try {
            mail.sendPasswordCode(email, code, policy.lifetime(), language);
        } catch (RuntimeException exception) {
            transaction.executeWithoutResult(status -> challenges.lockById(challengeId)
                    .ifPresent(row -> row.moveTo(FAILED, clock.instant())));
            if (exception instanceof ApiException api) {
                throw api;
            }
            throw new ApiException(UserErrorCode.USER_MAIL_UNAVAILABLE, "The code could not be sent.", exception);
        }
    }

    private Verification verify(Actor actor, UUID challengeId, String code) {
        Instant now = clock.instant();
        var row = challenges.lockById(challengeId).filter(c -> c.belongsTo(actor.issuer(), actor.subject()));
        if (row.isEmpty()) {
            return Verification.of(Outcome.NOT_FOUND);
        }

        PasswordChallenge challenge = row.get();
        boolean expired = !now.isBefore(challenge.getExpiresAt());
        if (challenge.getStatus() == APPLYING && !expired) {
            return Verification.of(Outcome.IN_PROGRESS);
        }
        if (challenge.getStatus() != PENDING || expired || challenge.getFailedAttempts() >= policy.maxAttempts()) {
            return Verification.of(Outcome.EXPIRED);
        }
        if (!PasswordCode.matches(challengeId, code, challenge.getCodeHash())) {
            challenge.recordFailedAttempt(now);
            return new Verification(Outcome.WRONG_CODE, policy.maxAttempts() - challenge.getFailedAttempts());
        }

        challenge.moveTo(APPLYING, now);
        return Verification.of(Outcome.ACCEPTED);
    }

    private void apply(Actor actor, UUID challengeId, String newPassword) {
        try {
            identity.setPassword(actor.subject(), newPassword);
        } catch (RuntimeException exception) {
            // The code stays usable with another password, e.g. after a password policy rejection.
            transaction.executeWithoutResult(status -> challenges.lockById(challengeId)
                    .filter(row -> row.getStatus() == APPLYING)
                    .ifPresent(row -> row.moveTo(PENDING, clock.instant())));
            throw exception;
        }

        transaction.executeWithoutResult(status -> {
            challenges.lockById(challengeId)
                    .orElseThrow(() -> new IllegalStateException("An applied password change has no challenge."))
                    .moveTo(USED, clock.instant());
            caller.record(actor, "USER_PASSWORD_CHANGED", Map.of("challengeId", challengeId.toString()));
        });
    }

    private PasswordChangeResult signOutOthers() {
        try {
            int count = security.signOutOthers().signedOut();
            return new PasswordChangeResult(PasswordChangeResult.OtherSessions.SIGNED_OUT, count);
        } catch (RuntimeException exception) {
            log.warn("Password changed but other sessions could not be signed out: {}",
                    exception.getClass().getSimpleName());
            return new PasswordChangeResult(PasswordChangeResult.OtherSessions.FAILED, 0);
        }
    }

    private void notifyChanged(Actor actor, AccountMail.Language language) {
        try {
            String email = identity.account(actor.subject()).email();
            if (email != null && !email.isBlank() && mail.available()) {
                mail.sendPasswordChanged(email, language);
            }
        } catch (RuntimeException exception) {
            log.warn("Password change notice was not sent: {}", exception.getClass().getSimpleName());
        }
    }

    private enum Outcome {
        ACCEPTED,
        NOT_FOUND,
        EXPIRED,
        IN_PROGRESS,
        WRONG_CODE
    }

    /** Verification result returned from the transaction so failed attempts commit before the error is raised. */
    private record Verification(
            Outcome outcome,
            int attemptsRemaining
    ) {
        static Verification of(Outcome outcome) {
            return new Verification(outcome, 0);
        }

        void throwIfRejected() {
            switch (outcome) {
                case ACCEPTED -> {
                }
                case NOT_FOUND -> throw new ApiException(UserErrorCode.USER_PASSWORD_CHALLENGE_NOT_FOUND,
                        "The password change was not found.");
                case EXPIRED -> throw new ApiException(UserErrorCode.USER_PASSWORD_CODE_EXPIRED,
                        "The code is no longer valid. Request a new code.");
                case IN_PROGRESS -> throw new ApiException(UserErrorCode.USER_PASSWORD_CHANGE_IN_PROGRESS,
                        "The password change is already being applied.");
                case WRONG_CODE -> throw new ApiException(UserErrorCode.USER_PASSWORD_CODE_INVALID,
                        "The code is incorrect.", Map.of("attemptsRemaining", attemptsRemaining));
            }
        }
    }
}
