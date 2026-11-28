package com.wikiaov.community.community.internal.translation.persistence;

import com.wikiaov.community.community.internal.translation.domain.TranslatedPost.ImageText;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A post's translation into one language, kept until the post, the model or the prompt changes (ADR-037). */
@Entity
@Table(schema = "community", name = "post_translation")
public class PostTranslationRecord {
    @Id
    private UUID id = UUID.randomUUID();
    private UUID postId;
    private String locale;
    private String sourceHash;
    private String sourceLanguage;
    private String title;
    private String body;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<ImageText> images = new ArrayList<>();
    private String model;
    private long inputTokens;
    private long outputTokens;
    private long costMicros;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> failedChecks = new ArrayList<>();
    private Instant createdAt;

    public UUID getId() {
        return id;
    }

    public UUID getPostId() {
        return postId;
    }

    public void setPostId(UUID value) {
        postId = value;
    }

    public String getLocale() {
        return locale;
    }

    public void setLocale(String value) {
        locale = value;
    }

    public String getSourceHash() {
        return sourceHash;
    }

    public void setSourceHash(String value) {
        sourceHash = value;
    }

    public String getSourceLanguage() {
        return sourceLanguage;
    }

    public void setSourceLanguage(String value) {
        sourceLanguage = value;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String value) {
        title = value;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String value) {
        body = value;
    }

    public List<ImageText> getImages() {
        return images;
    }

    public void setImages(List<ImageText> value) {
        images = new ArrayList<>(value);
    }

    public String getModel() {
        return model;
    }

    public void setModel(String value) {
        model = value;
    }

    public long getInputTokens() {
        return inputTokens;
    }

    public void setInputTokens(long value) {
        inputTokens = value;
    }

    public long getOutputTokens() {
        return outputTokens;
    }

    public void setOutputTokens(long value) {
        outputTokens = value;
    }

    public long getCostMicros() {
        return costMicros;
    }

    public void setCostMicros(long value) {
        costMicros = value;
    }

    public List<String> getFailedChecks() {
        return failedChecks;
    }

    public void setFailedChecks(List<String> value) {
        failedChecks = new ArrayList<>(value);
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant value) {
        createdAt = value;
    }
}
