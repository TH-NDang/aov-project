package com.wikiaov.gamemode.internal.application;

import com.wikiaov.access.Actor;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.gamemode.internal.domain.RevisionRecord;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.ApiFieldError;
import com.wikiaov.platform.RevisionState;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * The draft and publication rules shared by mode and guide revisions (01 section 9): drafts only are edited, the
 * expected version must match, and every state change is audited in the same transaction.
 */
@Component
public class RevisionWorkflow {
    private final CurrentActor actors;

    private final AuditLog audit;

    private final Clock clock;

    public RevisionWorkflow(CurrentActor actors, AuditLog audit, Clock clock) {
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }

    public Actor actor() {
        return actors.require();
    }

    public Instant now() {
        return clock.instant();
    }

    public <R extends RevisionRecord> R requireEditableDraft(R revision, long expectedVersion) {
        if (revision.getState() != RevisionState.DRAFT)
            throw new ApiException(GameModeErrorCode.GAME_MODE_CONFLICT, "Only drafts can be changed.");
        if (revision.getVersion() != expectedVersion)
            throw new ApiException(GameModeErrorCode.GAME_MODE_CONFLICT, "The draft has changed.",
                    Map.of("currentVersion", revision.getVersion()));
        return revision;
    }

    public void requireNoOpenDraft(boolean hasDraft, UUID existingDraftId) {
        if (hasDraft)
            throw new ApiException(GameModeErrorCode.GAME_MODE_CONFLICT, "A draft is already open.",
                    Map.of("existingDraftId", existingDraftId));
    }

    public void rejectInvalid(List<ApiFieldError> errors) {
        if (!errors.isEmpty())
            throw new ApiException(GameModeErrorCode.GAME_MODE_INVALID_CONTENT, "The content is not valid.",
                    errors);
    }

    public void rejectIncomplete(List<String> missing) {
        if (!missing.isEmpty())
            throw new ApiException(GameModeErrorCode.GAME_MODE_INVALID_CONTENT,
                    "Complete the required fields before publication.", Map.of("missingFields", missing));
    }

    /** Applies an edit to a draft: bumps the version and stamps the editor. */
    public void advance(RevisionRecord revision, String changeNote) {
        var actor = actor();
        revision.setVersion(revision.getVersion() + 1);
        if (changeNote != null)
            revision.setChangeNote(changeNote);
        revision.touch(actor.issuer(), actor.subject(), now());
    }

    public void publish(RevisionRecord revision, String changeNote) {
        revision.setState(RevisionState.PUBLISHED);
        revision.setPublishedAt(now());
        advance(revision, changeNote);
    }

    public void discard(RevisionRecord revision, String changeNote) {
        revision.setState(RevisionState.DISCARDED);
        advance(revision, changeNote);
    }

    public void record(String action, String aggregateType, UUID aggregateId, RevisionRecord revision,
            Long beforeVersion, String reason) {
        audit.record(new AuditEntry(actor(), action, aggregateType, aggregateId,
                revision == null ? null : revision.getId(), beforeVersion,
                revision == null ? null : revision.getVersion(), reason, Map.of()));
    }
}
