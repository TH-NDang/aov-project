package com.wikiaov.community.tournament.internal.verification.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Persistable;

/** One checked version of one part of a tournament. Checking the same version again keeps the newest check. */
@Entity
@Table(schema = "tournament", name = "content_verification")
public class ContentVerificationRecord implements Persistable<UUID> {
    @Id
    private UUID id;
    @Version
    private long version;
    private UUID tournamentId;
    private String part;
    private String contentToken;
    private @Nullable String label;
    private @Nullable String note;
    private Instant verifiedAt;
    private String verifiedBy;
    private @Nullable String verifiedByName;
    @Transient
    private boolean stored;

    protected ContentVerificationRecord() {
    }

    public static ContentVerificationRecord check(UUID tournamentId, String part, String contentToken, Check check) {
        var record = new ContentVerificationRecord();
        record.id = UUID.randomUUID();
        record.tournamentId = tournamentId;
        record.part = part;
        record.contentToken = contentToken;
        record.stamp(check);
        return record;
    }

    /** The same version checked again, by the same person or another. */
    public void recheck(Check check) {
        stamp(check);
    }

    private void stamp(Check check) {
        label = check.label();
        note = check.note();
        verifiedAt = check.at();
        verifiedBy = check.actorKey();
        verifiedByName = check.actorName();
    }

    @Override
    public UUID getId() {
        return id;
    }

    @Override
    public boolean isNew() {
        return !stored;
    }

    @PostPersist
    @PostLoad
    void markStored() {
        stored = true;
    }

    public long getVersion() {
        return version;
    }

    public UUID getTournamentId() {
        return tournamentId;
    }

    public String getPart() {
        return part;
    }

    public String getContentToken() {
        return contentToken;
    }

    public @Nullable String getLabel() {
        return label;
    }

    public @Nullable String getNote() {
        return note;
    }

    public Instant getVerifiedAt() {
        return verifiedAt;
    }

    public String getVerifiedBy() {
        return verifiedBy;
    }

    public @Nullable String getVerifiedByName() {
        return verifiedByName;
    }

    /** Who checked and when, with what Admin called the part at that moment. */
    public record Check(
            String actorKey,
            @Nullable String actorName,
            Instant at,
            @Nullable String label,
            @Nullable String note
    ) {
    }
}
