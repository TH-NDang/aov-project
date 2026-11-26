package com.wikiaov.patch.internal.watch.application;

import com.wikiaov.patch.internal.watch.application.port.PatchNoteFeed.Answer;
import com.wikiaov.patch.internal.watch.application.port.PatchNoteFeed.Validators;
import com.wikiaov.patch.internal.watch.domain.FoundPatchNote;
import com.wikiaov.patch.internal.watch.domain.PatchNoteFailure;
import com.wikiaov.patch.internal.watch.domain.PatchNotePostState;
import com.wikiaov.patch.internal.watch.domain.PatchNoteSource;
import com.wikiaov.patch.internal.watch.domain.PatchWatchRules;
import com.wikiaov.patch.internal.watch.persistence.PatchNotePostRepository;
import com.wikiaov.patch.internal.watch.persistence.PatchNoteSourceCheckRepository;
import com.wikiaov.patch.internal.watch.persistence.entity.PatchNotePost;
import com.wikiaov.patch.internal.watch.persistence.entity.PatchNoteSourceCheck;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The database side of a check. Each method is its own short transaction, so no transaction stays open while a
 * publisher's page is downloaded.
 */
@Component
@Transactional
public class PatchNoteInbox {
    private final PatchNoteSourceCheckRepository checks;
    private final PatchNotePostRepository posts;
    private final PatchWatchProperties properties;

    public PatchNoteInbox(PatchNoteSourceCheckRepository checks, PatchNotePostRepository posts,
            PatchWatchProperties properties) {
        this.checks = checks;
        this.posts = posts;
        this.properties = properties;
    }

    /** A post the check found without a title, to be named from its own page. */
    public record Untitled(
            UUID id,
            String url
    ) {
    }

    /**
     * Claims the next read of {@code source}. Returns the validators to send, or null when the source is not due: the
     * schedule waits for {@code next_check_at} and skips paused sources, an editor's check only waits for
     * {@link PatchWatchRules#MANUAL_GAP}.
     */
    public @Nullable Validators begin(PatchNoteSource source, Instant now, boolean manual) {
        PatchNoteSourceCheck check = checks.lock(source).orElseGet(() -> PatchNoteSourceCheck.first(source, now));
        boolean due = manual
                ? PatchWatchRules.manualCheckAllowed(check.getLastCheckedAt(), now)
                : check.dueAt(now);
        if (!due) {
            return null;
        }

        check.start(now, properties.zone());
        checks.saveAndFlush(check);

        return new Validators(check.getEtag(), check.getLastModified());
    }

    /** Stores the posts not seen before and returns the new ones that still need a title. */
    public List<Untitled> record(PatchNoteSource source, Answer answer, Instant now) {
        PatchNoteSourceCheck check = checks.lock(source).orElseGet(() -> PatchNoteSourceCheck.first(source, now));
        check.succeeded(now, properties.zone(), answer.etag(), answer.lastModified(), answer.notModified());
        checks.save(check);
        if (answer.notModified()) {
            return List.of();
        }

        Map<String, FoundPatchNote> found = new LinkedHashMap<>();
        answer.posts().forEach(post -> found.putIfAbsent(post.externalId(), post));
        Set<String> known = found.isEmpty()
                ? Set.of()
                : new HashSet<>(posts.knownExternalIds(source, found.keySet()));

        List<Untitled> untitled = new ArrayList<>();
        for (FoundPatchNote post : found.values()) {
            if (known.contains(post.externalId())) {
                continue;
            }
            PatchNotePostState state = PatchWatchRules.firstState(post.publishedAt(), now);
            PatchNotePost stored = posts.save(PatchNotePost.found(source, post, state, now));
            if (state == PatchNotePostState.NEW && post.title() == null) {
                untitled.add(new Untitled(stored.getId(), stored.getUrl()));
            }
        }
        return untitled;
    }

    public void fail(PatchNoteSource source, PatchNoteFailure failure, @Nullable Integer status, Instant now) {
        PatchNoteSourceCheck check = checks.lock(source).orElseGet(() -> PatchNoteSourceCheck.first(source, now));
        check.failed(failure, status, now, properties.zone());
        checks.save(check);
    }

    public void name(UUID id, String title) {
        posts.findById(id).ifPresent(post -> post.nameIfUntitled(title));
    }
}
