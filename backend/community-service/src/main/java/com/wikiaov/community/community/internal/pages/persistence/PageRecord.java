package com.wikiaov.community.community.internal.pages.persistence;

import com.wikiaov.community.community.internal.domain.PageContent;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(schema = "community", name = "page")
public class PageRecord {
    @Id
    private UUID id;
    @Version
    private long version;
    private String code;
    @Enumerated(EnumType.STRING)
    private PageContent.Kind kind;
    private UUID entityId;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private PageContent content;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private PageContent publishedContent;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private PageContent.Presentation presentation;
    private Instant publishedAt;
    private Instant updatedAt;

    public PageRecord() {
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

    public String getCode() {
        return code;
    }

    public void setCode(String value) {
        this.code = value;
    }

    public PageContent.Kind getKind() {
        return kind;
    }

    public void setKind(PageContent.Kind value) {
        this.kind = value;
    }

    public UUID getEntityId() {
        return entityId;
    }

    public void setEntityId(UUID value) {
        this.entityId = value;
    }

    public PageContent getContent() {
        return shown(content);
    }

    public void setContent(PageContent value) {
        this.content = shown(value);
    }

    public PageContent getPublishedContent() {
        return shown(publishedContent);
    }

    public void setPublishedContent(PageContent value) {
        this.publishedContent = shown(value);
    }

    /** One person's page has no pictures but those its verified representative chooses, which are its presentation. */
    private PageContent shown(PageContent value) {
        return value == null || kind == null || !kind.individual() ? value : value.withoutPictures();
    }

    public PageContent.Presentation getPresentation() {
        return presentation;
    }

    public void setPresentation(PageContent.Presentation value) {
        this.presentation = value;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(Instant value) {
        this.publishedAt = value;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant value) {
        this.updatedAt = value;
    }

}
