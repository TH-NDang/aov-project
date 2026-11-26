package com.wikiaov.patch.internal.watch.persistence.entity;

import com.wikiaov.patch.internal.watch.domain.PatchNoteFailure;
import com.wikiaov.patch.internal.watch.domain.PatchNoteSchedule;
import com.wikiaov.patch.internal.watch.domain.PatchNoteScheduleMode;
import com.wikiaov.patch.internal.watch.domain.PatchNoteSource;
import com.wikiaov.patch.internal.watch.domain.PatchWatchRules;
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
import java.time.LocalTime;
import java.time.ZoneId;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Persistable;

/** One source's reading schedule, how its last read went, and the validators to send next time (ADR-035). */
@Entity
@Table(schema = "patch", name = "note_source_check")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PatchNoteSourceCheck implements Persistable<PatchNoteSource> {

    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "source_code", nullable = false, length = 32)
    private PatchNoteSource source;

    @Enumerated(EnumType.STRING)
    @Column(name = "schedule_mode", nullable = false, length = 16)
    private PatchNoteScheduleMode scheduleMode;

    /** Wall-clock time in the watch's zone. */
    @Column(name = "daily_at", nullable = false)
    private LocalTime dailyAt;

    @Column(name = "every_hours", nullable = false)
    private int everyHours;

    @Column(name = "paused", nullable = false)
    private boolean paused;

    @Column(name = "last_checked_at")
    private @Nullable Instant lastCheckedAt;

    @Column(name = "last_success_at")
    private @Nullable Instant lastSuccessAt;

    @Column(name = "next_check_at", nullable = false)
    private Instant nextCheckAt;

    @Column(name = "failure_count", nullable = false)
    private int failureCount;

    @Enumerated(EnumType.STRING)
    @Column(name = "last_failure", length = 32)
    private @Nullable PatchNoteFailure lastFailure;

    @Column(name = "last_failure_status")
    private @Nullable Integer lastFailureStatus;

    @Column(name = "etag", length = 256)
    private @Nullable String etag;

    @Column(name = "last_modified", length = 64)
    private @Nullable String lastModified;

    @Column(name = "schedule_changed_at")
    private @Nullable Instant scheduleChangedAt;

    @Column(name = "schedule_changed_by_issuer")
    private @Nullable String scheduleChangedByIssuer;

    @Column(name = "schedule_changed_by_subject")
    private @Nullable String scheduleChangedBySubject;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @Transient
    private boolean persisted;

    /** A source seen for the first time is read at once, then on the default schedule. */
    public static PatchNoteSourceCheck first(PatchNoteSource source, Instant now) {
        PatchNoteSourceCheck check = new PatchNoteSourceCheck();
        check.source = source;
        check.scheduleMode = PatchNoteSchedule.DEFAULT.mode();
        check.dailyAt = PatchNoteSchedule.DEFAULT.dailyAt();
        check.everyHours = PatchNoteSchedule.DEFAULT.everyHours();
        check.nextCheckAt = now;
        return check;
    }

    public PatchNoteSchedule schedule() {
        return new PatchNoteSchedule(scheduleMode, dailyAt, everyHours);
    }

    public boolean dueAt(Instant now) {
        return !paused && !nextCheckAt.isAfter(now);
    }

    /** Claims the read, so a second runner that looks at the same moment skips it. */
    public void start(Instant now, ZoneId zone) {
        lastCheckedAt = now;
        nextCheckAt = schedule().next(now, zone);
    }

    public void succeeded(Instant now, ZoneId zone, @Nullable String newEtag, @Nullable String newLastModified,
            boolean notModified) {
        lastSuccessAt = now;
        nextCheckAt = schedule().next(now, zone);
        failureCount = 0;
        lastFailure = null;
        lastFailureStatus = null;
        if (!notModified) {
            etag = clip(newEtag, 256);
            lastModified = clip(newLastModified, 64);
        }
    }

    public void failed(PatchNoteFailure failure, @Nullable Integer status, Instant now, ZoneId zone) {
        failureCount++;
        lastFailure = failure;
        lastFailureStatus = status;
        nextCheckAt = PatchWatchRules.retryAt(now, failureCount, schedule().next(now, zone));
    }

    /** A new schedule takes effect at once: the next read is planned from now. */
    public void reschedule(PatchNoteSchedule next, boolean pause, String issuer, String subject, Instant now,
            ZoneId zone) {
        scheduleMode = next.mode();
        dailyAt = next.dailyAt();
        everyHours = next.everyHours();
        paused = pause;
        nextCheckAt = next.next(now, zone);
        scheduleChangedAt = now;
        scheduleChangedByIssuer = issuer;
        scheduleChangedBySubject = subject;
    }

    @Override
    public PatchNoteSource getId() {
        return source;
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

    /** A validator too long for its column is dropped rather than cut, since a cut one would never match. */
    private static @Nullable String clip(@Nullable String value, int max) {
        return value == null || value.length() > max ? null : value;
    }
}
