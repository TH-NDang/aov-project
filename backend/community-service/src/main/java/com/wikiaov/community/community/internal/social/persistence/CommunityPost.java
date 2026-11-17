package com.wikiaov.community.community.internal.social.persistence;

import com.wikiaov.community.community.internal.domain.PostStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(schema = "community", name = "post")
public class CommunityPost {
    @Id
    private UUID id;
    @Version
    private long version;
    private UUID pageId;
    private String actor;
    private String authorName;
    private boolean asPage;
    private String body;
    @Enumerated(EnumType.STRING)
    private PostStatus status;
    private Instant createdAt;
    private Instant updatedAt;
    private String kind = "TEXT";
    private String title;
    private String videoUrl;
    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> imageUrls = new ArrayList<>();
    private Instant pinnedAt;

    public CommunityPost() {
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

    public String getAuthorName() {
        return authorName;
    }

    public void setAuthorName(String value) {
        this.authorName = value;
    }

    public boolean getAsPage() {
        return asPage;
    }

    public void setAsPage(boolean value) {
        this.asPage = value;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String value) {
        this.body = value;
    }

    public PostStatus getStatus() {
        return status;
    }

    public void setStatus(PostStatus value) {
        this.status = value;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant value) {
        this.createdAt = value;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant value) {
        this.updatedAt = value;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String value) {
        this.kind = value;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String value) {
        this.title = value;
    }

    public String getVideoUrl() {
        return videoUrl;
    }

    public void setVideoUrl(String value) {
        this.videoUrl = value;
    }

    public List<String> getImageUrls() {
        return imageUrls;
    }

    public void setImageUrls(List<String> value) {
        this.imageUrls = new ArrayList<>(value);
    }

    public Instant getPinnedAt() {
        return pinnedAt;
    }

    public void setPinnedAt(Instant value) {
        this.pinnedAt = value;
    }
}
