package com.wikiaov.patch.internal.watch.application;

import com.wikiaov.access.Actor;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.patch.internal.watch.application.PatchWatchCommands.AddPatchNotePost;
import com.wikiaov.patch.internal.watch.application.PatchWatchCommands.ChangePatchNoteSchedule;
import com.wikiaov.patch.internal.watch.application.PatchWatchCommands.ChangePatchNoteState;
import com.wikiaov.patch.internal.watch.application.PatchWatchViews.PatchNotePostView;
import com.wikiaov.patch.internal.watch.application.PatchWatchViews.PatchNoteSourceView;
import com.wikiaov.patch.internal.watch.application.PatchWatchViews.PatchWatchOverview;
import com.wikiaov.patch.internal.watch.domain.PatchNotePostState;
import com.wikiaov.patch.internal.watch.domain.PatchNoteSchedule;
import com.wikiaov.patch.internal.watch.domain.PatchNoteSource;
import com.wikiaov.patch.internal.watch.persistence.PatchNotePostRepository;
import com.wikiaov.patch.internal.watch.persistence.PatchNoteSourceCheckRepository;
import com.wikiaov.patch.internal.watch.persistence.entity.PatchNotePost;
import com.wikiaov.patch.internal.watch.persistence.entity.PatchNoteSourceCheck;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PageSlice;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The Admin side of the patch watch (ADR-035): the inbox of posts found, the sources and their schedules. */
@Service
public class PatchWatch {
    static final String POST_AGGREGATE = "PATCH_NOTE_POST";
    static final String SOURCE_AGGREGATE = "PATCH_NOTE_SOURCE";
    private static final Sort INBOX_ORDER = Sort.by(Sort.Order.desc("listedAt"), Sort.Order.asc("id"));

    private final PatchNotePostRepository posts;
    private final PatchNoteSourceCheckRepository checks;
    private final PatchNoteChecks runner;
    private final PatchWatchProperties properties;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    public PatchWatch(PatchNotePostRepository posts, PatchNoteSourceCheckRepository checks, PatchNoteChecks runner,
            PatchWatchProperties properties, CurrentActor actors, AuditLog audit, Clock clock) {
        this.posts = posts;
        this.checks = checks;
        this.runner = runner;
        this.properties = properties;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PatchWatchOverview overview() {
        Map<PatchNoteSource, PatchNoteSourceCheck> stored = checks.findAll().stream()
                .collect(Collectors.toMap(PatchNoteSourceCheck::getSource, Function.identity()));
        Instant now = clock.instant();

        var sources = PatchNoteSource.checked().stream()
                .map(source -> sourceView(source, stored.getOrDefault(source, PatchNoteSourceCheck.first(source, now))))
                .toList();
        return new PatchWatchOverview(properties.enabled(), properties.zone().getId(),
                posts.countByState(PatchNotePostState.NEW), sources);
    }

    /** Pages through the inbox, newest first. Without a state every post is listed, history included. */
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<PatchNotePostView> posts(@Nullable PatchNotePostState state, int page, int size) {
        PageRequest request = PageRequest.of(page, size, INBOX_ORDER);
        Page<PatchNotePost> result = state == null ? posts.findAll(request) : posts.findByState(state, request);

        return new PageSlice<>(result.getContent().stream().map(PatchWatch::postView).toList(), page, size,
                result.getTotalElements());
    }

    @PreAuthorize("hasAuthority('patch:write')")
    @Transactional
    public PatchNotePostView changeState(UUID id, ChangePatchNoteState input) {
        if (!input.state().chosenByEditor()) {
            throw invalid("A post can be moved to NEW, DONE or DISMISSED only.");
        }

        PatchNotePost post = posts.findById(id).orElseThrow(PatchWatch::notFound);
        if (post.getLockVersion() != input.expectedVersion()) {
            throw new ApiException(PatchWatchErrorCode.PATCH_NOTE_POST_CONFLICT,
                    "The post has changed. Reload before saving.");
        }

        Actor actor = actors.require();
        long before = post.getLockVersion();
        PatchNotePostState previous = post.getState();
        post.moveTo(input.state(), actor.issuer(), actor.subject(), clock.instant());
        posts.saveAndFlush(post);

        audit.record(new AuditEntry(actor, "PATCH_NOTE_POST_STATE_CHANGED", POST_AGGREGATE, post.getId(), null, before,
                post.getLockVersion(), null, Map.of("from", previous.name(), "to", input.state().name())));

        return postView(post);
    }

    @PreAuthorize("hasAuthority('patch:write')")
    @Transactional
    public PatchNotePostView add(AddPatchNotePost input) {
        String url = webAddress(input.url().strip());
        String title = input.title().strip();
        if (title.isEmpty()) {
            throw invalid("Give the post a title.");
        }
        if (posts.existsByUrl(url)) {
            throw new ApiException(PatchWatchErrorCode.PATCH_NOTE_POST_DUPLICATE, "This post is already listed.");
        }

        Actor actor = actors.require();
        PatchNotePost post = PatchNotePost.added(url, title, input.region(), input.channel(), actor.issuer(),
                actor.subject(), clock.instant());
        posts.saveAndFlush(post);

        audit.record(new AuditEntry(actor, "PATCH_NOTE_POST_ADDED", POST_AGGREGATE, post.getId(), null, null,
                post.getLockVersion(), null,
                Map.of("region", input.region().name(), "channel", input.channel().name())));

        return postView(post);
    }

    @PreAuthorize("hasAuthority('patch:write')")
    @Transactional
    public PatchNoteSourceView changeSchedule(PatchNoteSource source, ChangePatchNoteSchedule input) {
        if (source == PatchNoteSource.MANUAL) {
            throw invalidSchedule("Posts added by hand have no schedule.");
        }
        if (!PatchNoteSchedule.validHours(input.everyHours())) {
            throw invalidSchedule("Read a source every 1 to 24 hours.");
        }

        Instant now = clock.instant();
        PatchNoteSourceCheck check = checks.lock(source).orElseGet(() -> PatchNoteSourceCheck.first(source, now));
        if (check.getLockVersion() != input.expectedVersion()) {
            throw new ApiException(PatchWatchErrorCode.PATCH_NOTE_SCHEDULE_CONFLICT,
                    "The schedule has changed. Reload before saving.");
        }

        Actor actor = actors.require();
        long before = check.getLockVersion();
        PatchNoteSchedule schedule = new PatchNoteSchedule(input.mode(), input.dailyAt(), input.everyHours());
        check.reschedule(schedule, input.paused(), actor.issuer(), actor.subject(), now, properties.zone());
        checks.saveAndFlush(check);

        audit.record(new AuditEntry(actor, "PATCH_NOTE_SCHEDULE_CHANGED", SOURCE_AGGREGATE, sourceId(source), null,
                before, check.getLockVersion(), null,
                Map.of("source", source.name(), "mode", schedule.mode().name(), "dailyAt",
                        schedule.dailyAt().toString(), "everyHours", schedule.everyHours(), "paused",
                        input.paused())));

        return sourceView(source, check);
    }

    /**
     * Reads every source now, except those read in the last two minutes, then answers the overview. Runs outside a
     * transaction: pages are downloaded between the short writes of the check.
     */
    @PreAuthorize("hasAuthority('patch:write')")
    public PatchWatchOverview checkNow() {
        runner.runNow();
        return overview();
    }

    private PatchNoteSourceView sourceView(PatchNoteSource source, PatchNoteSourceCheck check) {
        boolean readable = runner.readable(source);
        PatchNoteSchedule schedule = check.schedule();
        return new PatchNoteSourceView(source, source.region(), source.channels(),
                Objects.requireNonNull(source.pageUrl(), "pageUrl"), readable, schedule.mode(), schedule.dailyAt(),
                schedule.everyHours(), check.isPaused(), check.getLastCheckedAt(), check.getLastSuccessAt(),
                readable && !check.isPaused() ? check.getNextCheckAt() : null, check.getFailureCount(),
                check.getLastFailure(), check.getLastFailureStatus(), check.getLockVersion());
    }

    private static PatchNotePostView postView(PatchNotePost post) {
        return new PatchNotePostView(post.getId(), post.getSource(), post.getRegion(), post.getChannel(),
                post.getUrl(), post.getTitle(), post.getPublishedAt(), post.getFirstSeenAt(), post.getState(),
                post.getStateChangedAt(), post.getLockVersion());
    }

    /** The audit trail keys rows by UUID; a source is named by its code, so its id is derived from the code. */
    static UUID sourceId(PatchNoteSource source) {
        return UUID.nameUUIDFromBytes(("patch-note-source:" + source.name()).getBytes(StandardCharsets.UTF_8));
    }

    private static String webAddress(String value) {
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme();
            if (scheme == null || uri.getHost() == null
                    || !(scheme.equalsIgnoreCase("https") || scheme.equalsIgnoreCase("http"))) {
                throw invalid("Paste the full link of the post, starting with https://.");
            }
            return uri.normalize().toString();
        } catch (URISyntaxException ex) {
            throw invalid("Paste the full link of the post, starting with https://.");
        }
    }

    private static ApiException notFound() {
        return new ApiException(PatchWatchErrorCode.PATCH_NOTE_POST_NOT_FOUND, "The post was not found.");
    }

    private static ApiException invalid(String message) {
        return new ApiException(PatchWatchErrorCode.PATCH_NOTE_POST_INVALID, message);
    }

    private static ApiException invalidSchedule(String message) {
        return new ApiException(PatchWatchErrorCode.PATCH_NOTE_SCHEDULE_INVALID, message);
    }
}
