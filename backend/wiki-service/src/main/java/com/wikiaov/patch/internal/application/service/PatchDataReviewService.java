package com.wikiaov.patch.internal.application.service;
import com.wikiaov.access.*;
import com.wikiaov.patch.PatchDataReviews;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.application.response.PatchDataReviewView;
import com.wikiaov.patch.internal.persistence.*;
import com.wikiaov.patch.internal.persistence.entity.PatchDataReview;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
@Service
@Transactional
public class PatchDataReviewService implements PatchDataReviews {
    private final PatchDataReviewRepository reviews;
    private final PatchVariantRepository variants;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;
    public PatchDataReviewService(PatchDataReviewRepository reviews, PatchVariantRepository variants,
            CurrentActor actors, AuditLog audit, Clock clock) {
        this.reviews = reviews;
        this.variants = variants;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }
    public record Update(
            String state,
            long expectedVersion
    ) {
    }
    @PreAuthorize("hasAuthority('patch:write')")
    public PatchDataReviewView update(UUID id, Update input) {
        var variant = variants.lockById(id).orElseThrow(
                () -> new ApiException(PatchErrorCode.PATCH_NOT_FOUND, "The patch variant was not found."));
        if (input.state() == null || !Set.of("IN_PROGRESS", "COMPLETE").contains(input.state())
                || input.expectedVersion() < 0)
            throw new ApiException(PatchErrorCode.PATCH_INVALID, "Invalid editorial review state.");
        if (!variant.getStatus().equals("PUBLISHED"))
            throw new ApiException(PatchErrorCode.PATCH_INVALID,
                    "Publish the patch variant before completing data review.");
        var value = reviews.findById(id).orElseGet(PatchDataReview::new);
        if (value.getVersion() != input.expectedVersion())
            throw new ApiException(PatchErrorCode.PATCH_CONFLICT,
                    "The patch data review has changed. Reload before saving.");
        var actor = actors.require();
        value.setPatchVariantId(id);
        value.setState(input.state());
        value.setVersion(value.getVersion() + 1);
        value.setCompletedAt(input.state().equals("COMPLETE") ? clock.instant() : null);
        value.setUpdatedAt(clock.instant());
        value.setUpdatedByIssuer(actor.issuer());
        value.setUpdatedBySubject(actor.subject());
        reviews.saveAndFlush(value);
        audit.record(new AuditEntry(actor, "PATCH_DATA_REVIEW_UPDATED", "PATCH", id, null, input.expectedVersion(),
                value.getVersion(), null, Map.of("state", input.state())));
        return new PatchDataReviewView(id, value.getState(), value.getVersion(), value.getCompletedAt());
    }
    @Transactional(propagation = Propagation.MANDATORY)
    public void markDirty(UUID id) {
        if (id == null)
            return;
        variants.lockById(id).orElseThrow(
                () -> new ApiException(PatchErrorCode.PATCH_NOT_FOUND, "The patch variant was not found."));
        var value = reviews.findById(id).orElse(null);
        if (value == null || !value.getState().equals("COMPLETE"))
            return;
        var actor = actors.require();
        long previous = value.getVersion();
        value.setState("IN_PROGRESS");
        value.setVersion(previous + 1);
        value.setCompletedAt(null);
        value.setUpdatedAt(clock.instant());
        value.setUpdatedByIssuer(actor.issuer());
        value.setUpdatedBySubject(actor.subject());
        reviews.saveAndFlush(value);
        audit.record(new AuditEntry(actor, "PATCH_DATA_REVIEW_REOPENED", "PATCH", id, null, previous,
                value.getVersion(), null, Map.of()));
    }
}
