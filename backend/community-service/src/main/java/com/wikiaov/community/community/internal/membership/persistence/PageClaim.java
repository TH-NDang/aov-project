package com.wikiaov.community.community.internal.membership.persistence;

import com.wikiaov.community.community.internal.domain.ClaimStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "community", name = "page_claim")
public class PageClaim {
    @Id
    private UUID id;
    @Version
    private long version;
    private UUID pageId;
    private String actor;
    private String name;
    private String evidence;
    @Enumerated(EnumType.STRING)
    private ClaimStatus status;
    private String resolution;
    private String reviewedBy;
    private Instant createdAt;

    public PageClaim() {
        this.id = UUID.randomUUID();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID value) {
        this.id = value;
    }

    public long getVersion() {
        return version;
    }

    public UUID getPageId() {
        return pageId;
    }

    public void setPageId(UUID value) {
        this.pageId = value;
    }

    public String getActor() {
        return actor;
    }

    public void setActor(String value) {
        this.actor = value;
    }

    public String getName() {
        return name;
    }

    public void setName(String value) {
        this.name = value;
    }

    public String getEvidence() {
        return evidence;
    }

    public void setEvidence(String value) {
        this.evidence = value;
    }

    public ClaimStatus getStatus() {
        return status;
    }

    public void setStatus(ClaimStatus value) {
        this.status = value;
    }

    public String getResolution() {
        return resolution;
    }

    public void setResolution(String value) {
        this.resolution = value;
    }

    public String getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(String value) {
        this.reviewedBy = value;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant value) {
        this.createdAt = value;
    }

}
