package com.wikiaov.video;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Implemented by every module that owns something a video can be attached to (ADR-019).
 *
 * <p>The owner stays the source of truth: the video module asks each provider instead of reading other modules' tables.
 * Implementations are Spring beans; the video module collects all of them.
 */
public interface VideoSubjectProvider {

    /** Kinds answered by this provider. Each kind has exactly one provider. */
    Set<VideoSubjectKind> kinds();

    /** Whether the subject exists. {@code key} is null except for kinds that require one. */
    boolean exists(VideoSubjectKind kind, UUID id, @Nullable String key);

    /** Every subject owned by this module, named in {@code locale} where a translation exists. */
    List<VideoSubject> subjects(String locale);
}
