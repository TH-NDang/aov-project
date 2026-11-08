package com.wikiaov.gamemode.internal.domain;

import java.time.Instant;
import java.util.UUID;

/** What the draft and publication workflow needs from a mode or guide revision, independent of its content. */
public interface RevisionRecord {
    String DRAFT = "DRAFT";

    String PUBLISHED = "PUBLISHED";

    String DISCARDED = "DISCARDED";

    UUID getId();

    UUID getModeId();

    long getRevisionNo();

    String getState();

    void setState(String state);

    long getVersion();

    void setVersion(long version);

    UUID getSourceRevisionId();

    String getChangeNote();

    void setChangeNote(String changeNote);

    Instant getPublishedAt();

    void setPublishedAt(Instant publishedAt);

    Instant getCreatedAt();

    Instant getUpdatedAt();

    /** Records who changed the revision and when. */
    void touch(String issuer, String subject, Instant at);
}
