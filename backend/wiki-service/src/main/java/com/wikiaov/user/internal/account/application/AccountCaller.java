package com.wikiaov.user.internal.account.application;

import com.wikiaov.access.Actor;
import com.wikiaov.access.ActorType;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/** Resolves the human caller of an account security use case and records its audit trail. */
@Component
class AccountCaller {
    static final String AGGREGATE_TYPE = "USER_ACCOUNT";
    private final CurrentActor currentActor;
    private final AuditLog audit;
    private final TransactionTemplate transaction;

    AccountCaller(CurrentActor currentActor, AuditLog audit, TransactionTemplate transaction) {
        this.currentActor = currentActor;
        this.audit = audit;
        this.transaction = transaction;
    }

    Actor human() {
        Actor actor = currentActor.require();
        if (actor.type() != ActorType.HUMAN) {
            throw new ApiException(PlatformErrorCode.FORBIDDEN, "A human account is required.");
        }
        return actor;
    }

    /** Stable audit id of an identity-provider account, which has no UUID of its own in this service. */
    static UUID accountId(Actor actor) {
        return UUID.nameUUIDFromBytes((actor.issuer() + "\n" + actor.subject()).getBytes(StandardCharsets.UTF_8));
    }

    /** Records in its own transaction; callers have already finished the identity-provider call. */
    void record(Actor actor, String action, Map<String, Object> metadata) {
        transaction.executeWithoutResult(status -> audit.record(new AuditEntry(actor, action, AGGREGATE_TYPE,
                accountId(actor), null, null, null, null, metadata)));
    }
}
