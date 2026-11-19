package com.wikiaov.hero.internal.gallery.persistence.entity;

import com.wikiaov.hero.internal.gallery.domain.HeroGalleryKind;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** An image attached straight to a hero because no version of the hero uses it (ADR-027). */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(schema = "hero", name = "hero_gallery_item")
public class HeroGalleryItem {
    @Id
    private UUID id;
    private UUID heroId;
    private UUID assetId;
    @Enumerated(EnumType.STRING)
    private HeroGalleryKind kind;
    @Column(columnDefinition = "text")
    private String caption;
    private String partKey;
    private UUID untilPatchVariantId;
    private int sortOrder;
    @Column(name = "lock_version")
    private long version;
    private Instant createdAt;
    private Instant updatedAt;
    @Column(columnDefinition = "text")
    private String createdByIssuer;
    @Column(columnDefinition = "text")
    private String createdBySubject;
}
