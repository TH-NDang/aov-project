package com.wikiaov.hero.internal.gallery.application;

import com.wikiaov.platform.RevisionState;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** A hero's gallery: every image its versions show, then the images attached straight to it (ADR-027). */
@Schema(name = "HeroGalleryView")
public record HeroGalleryView(
        List<Image> items
) {

    /**
     * One image, once, however many places show it.
     *
     * @param kind       what it shows: HERO_ART, SKIN, SKILL, STICKER or OTHER
     * @param roles      where it shows, such as PORTRAIT, SKIN_ART:skinKey, SKILL_ICON:skillKey or GALLERY
     * @param current    shown by the version in effect, or part of the skill picture library
     * @param versions   versions that show it, newest first
     * @param attachment how it is attached to the hero, when it is
     */
    @Schema(name = "HeroGalleryImage")
    public record Image(
            UUID assetId,
            String kind,
            List<String> roles,
            @Nullable String partKey,
            @Nullable String partName,
            boolean current,
            List<Version> versions,
            @Nullable Attachment attachment
    ) {
    }

    @Schema(name = "HeroGalleryImageVersion")
    public record Version(
            UUID revisionId,
            long revisionNo,
            RevisionState state,
            boolean current,
            @Nullable UUID patchVariantId
    ) {
    }

    @Schema(name = "HeroGallerySaved")
    public record Saved(
            UUID id,
            long version
    ) {
    }

    @Schema(name = "HeroGalleryAttachment")
    public record Attachment(
            UUID id,
            @Nullable String caption,
            @Nullable UUID untilPatchVariantId,
            int sortOrder,
            long version
    ) {
    }

    /** An image attached straight to the hero. */
    @Schema(name = "HeroGalleryAttachRequest")
    public record Attach(
            UUID assetId,
            String kind,
            @Nullable String caption,
            @Nullable String partKey,
            @Nullable UUID untilPatchVariantId
    ) {
    }

    @Schema(name = "HeroGalleryUpdateRequest")
    public record Update(
            long expectedVersion,
            String kind,
            @Nullable String caption,
            @Nullable String partKey,
            @Nullable UUID untilPatchVariantId
    ) {
    }
}
