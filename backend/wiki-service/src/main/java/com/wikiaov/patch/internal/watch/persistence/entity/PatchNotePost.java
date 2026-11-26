package com.wikiaov.patch.internal.watch.persistence.entity;

import com.wikiaov.patch.internal.watch.domain.FoundPatchNote;
import com.wikiaov.patch.internal.watch.domain.PatchNoteChannel;
import com.wikiaov.patch.internal.watch.domain.PatchNotePostState;
import com.wikiaov.patch.internal.watch.domain.PatchNoteRegion;
import com.wikiaov.patch.internal.watch.domain.PatchNoteSource;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Persistable;

/** One post found on a publisher's page, or added by hand, and where it stands in the inbox (ADR-035). */
@Entity
@Table(schema = "patch", name = "note_post")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PatchNotePost implements Persistable<UUID> {

    @Id
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_code", nullable = false, length = 32, updatable = false)
    private PatchNoteSource source;

    @Column(name = "external_id", nullable = false, length = 300, updatable = false)
    private String externalId;

    @Enumerated(EnumType.STRING)
    @Column(name = "region", nullable = false, length = 8, updatable = false)
    private PatchNoteRegion region;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false, length = 16, updatable = false)
    private PatchNoteChannel channel;

    @Column(name = "url", nullable = false, length = 1000, updatable = false)
    private String url;

    @Column(name = "title", length = 500)
    private @Nullable String title;

    @Column(name = "published_at", updatable = false)
    private @Nullable Instant publishedAt;

    @Column(name = "first_seen_at", nullable = false, updatable = false)
    private Instant firstSeenAt;

    /** The publication time when the source gives one, the first sighting otherwise; the inbox sorts by it. */
    @Column(name = "listed_at", nullable = false, updatable = false)
    private Instant listedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "state", nullable = false, length = 16)
    private PatchNotePostState state;

    @Column(name = "state_changed_at")
    private @Nullable Instant stateChangedAt;

    @Column(name = "state_changed_by_issuer")
    private @Nullable String stateChangedByIssuer;

    @Column(name = "state_changed_by_subject")
    private @Nullable String stateChangedBySubject;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @Transient
    private boolean persisted;

    public static PatchNotePost found(PatchNoteSource source, FoundPatchNote found, PatchNotePostState state,
            Instant now) {
        PatchNotePost post = new PatchNotePost();
        post.id = UUID.randomUUID();
        post.source = source;
        post.externalId = found.externalId();
        post.region = source.region();
        post.channel = found.channel();
        post.url = found.url();
        post.title = found.title();
        post.publishedAt = found.publishedAt();
        post.firstSeenAt = now;
        post.listedAt = found.publishedAt() != null ? found.publishedAt() : now;
        post.state = state;
        return post;
    }

    public static PatchNotePost added(String url, String title, PatchNoteRegion region, PatchNoteChannel channel,
            String issuer, String subject, Instant now) {
        PatchNotePost post = new PatchNotePost();
        post.id = UUID.randomUUID();
        post.source = PatchNoteSource.MANUAL;
        post.externalId = url;
        post.region = region;
        post.channel = channel;
        post.url = url;
        post.title = title;
        post.firstSeenAt = now;
        post.listedAt = now;
        post.state = PatchNotePostState.NEW;
        post.stateChangedAt = now;
        post.stateChangedByIssuer = issuer;
        post.stateChangedBySubject = subject;
        return post;
    }

    public void moveTo(PatchNotePostState next, String issuer, String subject, Instant now) {
        state = next;
        stateChangedAt = now;
        stateChangedByIssuer = issuer;
        stateChangedBySubject = subject;
    }

    /** Fills a title the list did not carry; a title already known is kept. */
    public void nameIfUntitled(String found) {
        if (title == null) {
            title = found;
        }
    }

    @Override
    public boolean isNew() {
        return !persisted;
    }

    @PostPersist
    @PostLoad
    void markPersisted() {
        persisted = true;
    }
}
