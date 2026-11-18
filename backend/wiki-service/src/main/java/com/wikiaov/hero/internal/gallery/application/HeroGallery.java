package com.wikiaov.hero.internal.gallery.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.catalog.application.HeroQueries;
import com.wikiaov.hero.internal.gallery.application.HeroGalleryView.Attachment;
import com.wikiaov.hero.internal.gallery.application.HeroGalleryView.Image;
import com.wikiaov.hero.internal.gallery.application.HeroGalleryView.Version;
import com.wikiaov.hero.internal.gallery.persistence.HeroGalleryImagesRepository;
import com.wikiaov.hero.internal.gallery.persistence.HeroGalleryItemRepository;
import com.wikiaov.hero.internal.gallery.persistence.entity.HeroGalleryItem;
import com.wikiaov.hero.internal.media.persistence.HeroMediaUsageRepository;
import com.wikiaov.hero.internal.media.persistence.HeroMediaUsageRepository.PartName;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogAggregates;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.RevisionState;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A hero's gallery (ADR-027): the images its versions show, read from the versions, and the images attached straight
 * to the hero because no version uses them, such as skill icons from before a rework or stickers.
 */
@Service
@Transactional(readOnly = true)
public class HeroGallery {
    private static final Map<String, Set<MediaSemanticType>> ACCEPTED = Map.of(
            "HERO_ART", EnumSet.of(MediaSemanticType.HERO_HEAD, MediaSemanticType.HERO_PORTRAIT,
                    MediaSemanticType.HERO_SPLASH),
            "SKIN", EnumSet.of(MediaSemanticType.HERO_SKIN_ART),
            "SKILL", EnumSet.of(MediaSemanticType.HERO_SKILL_ICON),
            "STICKER", EnumSet.of(MediaSemanticType.CHIBI_STICKER),
            "OTHER", EnumSet.allOf(MediaSemanticType.class));

    private final HeroGalleryItemRepository items;
    private final HeroGalleryImagesRepository images;
    private final HeroMediaUsageRepository names;
    private final HeroStore store;
    private final HeroQueries queries;
    private final MediaAssets media;
    private final GameplayContexts contexts;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    public HeroGallery(HeroGalleryItemRepository items, HeroGalleryImagesRepository images,
            HeroMediaUsageRepository names, HeroStore store, HeroQueries queries, MediaAssets media,
            GameplayContexts contexts, CurrentActor actors, AuditLog audit, Clock clock) {
        this.items = items;
        this.images = images;
        this.names = names;
        this.store = store;
        this.queries = queries;
        this.media = media;
        this.contexts = contexts;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public HeroGalleryView read(UUID heroId, String locale) {
        HeroValidation.locale(locale);
        store.requireHero(heroId);

        var rows = images.versionImages(heroId);
        var current = queries.currentRevisionIds(Set.of(heroId), clock.instant());
        var library = images.libraryImages(heroId);
        var attached = items.findByHeroIdOrderBySortOrderAscCreatedAtAsc(heroId);
        var partNames = partNames(rows, locale);

        Map<UUID, Builder> gallery = new LinkedHashMap<>();
        for (var row : rows) {
            var image = gallery.computeIfAbsent(row.getAssetId(), Builder::new);
            image.place(row.getRole());
            boolean inEffect = current.contains(row.getRevisionId());
            image.current |= inEffect;
            image.versions.putIfAbsent(row.getRevisionId(), new Version(row.getRevisionId(), row.getRevisionNo(),
                    row.getState(), inEffect, row.getPatchVariantId()));
        }
        for (var row : library) {
            var image = gallery.computeIfAbsent(row.getAssetId(), Builder::new);
            String key = row.getSkillKey() != null
                    ? row.getSkillKey()
                    : "skill-" + row.getSourceSlot() + "-" + row.getVariantNo();
            image.place("SKILL_LIBRARY:" + key);
            image.current = true;
        }
        for (var item : attached) {
            var image = gallery.computeIfAbsent(item.getAssetId(), Builder::new);
            image.place("GALLERY");
            if (image.kind == null) {
                image.kind = item.getKind();
            }
            if (image.partKey == null) {
                image.partKey = item.getPartKey();
            }
            image.attachment = new Attachment(item.getId(), item.getCaption(), item.getUntilPatchVariantId(),
                    item.getSortOrder(), item.getVersion());
        }

        var result = gallery.values().stream().map(image -> image.build(partNames)).sorted(ORDER).toList();
        return new HeroGalleryView(result);
    }

    @Transactional
    @PreAuthorize("hasAuthority('hero:write')")
    public UUID attach(UUID heroId, HeroGalleryView.Attach input) {
        store.lockHero(heroId);
        if (input == null || input.assetId() == null) {
            throw HeroValidation.invalid("Choose an image to attach.");
        }
        String kind = kind(input.kind());
        requireAsset(input.assetId(), kind);
        String caption = caption(input.caption());
        String partKey = partKey(input.partKey());
        requirePatch(input.untilPatchVariantId());
        if (items.existsByHeroIdAndAssetId(heroId, input.assetId())) {
            throw new ApiException(HeroErrorCode.HERO_GALLERY_ITEM_CONFLICT,
                    "The image is already in this hero's gallery.");
        }

        var actor = actors.require();
        var item = new HeroGalleryItem();
        item.setId(UUID.randomUUID());
        item.setHeroId(heroId);
        item.setAssetId(input.assetId());
        item.setKind(kind);
        item.setCaption(caption);
        item.setPartKey(partKey);
        item.setUntilPatchVariantId(input.untilPatchVariantId());
        item.setSortOrder(items.lastSortOrder(heroId) + 1);
        item.setCreatedAt(clock.instant());
        item.setUpdatedAt(clock.instant());
        item.setCreatedByIssuer(actor.issuer());
        item.setCreatedBySubject(actor.subject());
        try {
            items.saveAndFlush(item);
        } catch (DataIntegrityViolationException duplicate) {
            throw new ApiException(HeroErrorCode.HERO_GALLERY_ITEM_CONFLICT,
                    "The image is already in this hero's gallery.");
        }

        audit.record(new AuditEntry(actor, "HERO_GALLERY_ITEM_ATTACHED", CatalogAggregates.HERO, heroId, null, null, 0L,
                null,
                Map.of("itemId", item.getId(), "assetId", input.assetId(), "kind", kind)));
        return item.getId();
    }

    @Transactional
    @PreAuthorize("hasAuthority('hero:write')")
    public HeroGalleryView.Saved update(UUID heroId, UUID itemId, HeroGalleryView.Update input) {
        store.lockHero(heroId);
        var item = require(heroId, itemId);
        if (input == null || item.getVersion() != input.expectedVersion()) {
            throw new ApiException(HeroErrorCode.HERO_GALLERY_ITEM_CONFLICT,
                    "The gallery image changed. Reload before saving.");
        }
        String kind = kind(input.kind());
        requireAsset(item.getAssetId(), kind);
        String caption = caption(input.caption());
        String partKey = partKey(input.partKey());
        requirePatch(input.untilPatchVariantId());

        item.setKind(kind);
        item.setCaption(caption);
        item.setPartKey(partKey);
        item.setUntilPatchVariantId(input.untilPatchVariantId());
        item.setVersion(Math.addExact(item.getVersion(), 1));
        item.setUpdatedAt(clock.instant());
        items.flush();

        audit.record(new AuditEntry(actors.require(), "HERO_GALLERY_ITEM_UPDATED", CatalogAggregates.HERO, heroId, null,
                input.expectedVersion(), item.getVersion(), null, Map.of("itemId", itemId)));
        return new HeroGalleryView.Saved(itemId, item.getVersion());
    }

    /** Takes the image out of the gallery; the image itself stays in media. */
    @Transactional
    @PreAuthorize("hasAuthority('hero:write')")
    public void remove(UUID heroId, UUID itemId, long expectedVersion) {
        store.lockHero(heroId);
        var item = require(heroId, itemId);
        if (item.getVersion() != expectedVersion) {
            throw new ApiException(HeroErrorCode.HERO_GALLERY_ITEM_CONFLICT,
                    "The gallery image changed. Reload before removing it.");
        }

        items.delete(item);
        items.flush();

        audit.record(new AuditEntry(actors.require(), "HERO_GALLERY_ITEM_REMOVED", CatalogAggregates.HERO, heroId, null,
                expectedVersion, null, null, Map.of("itemId", itemId, "assetId", item.getAssetId())));
    }

    private HeroGalleryItem require(UUID heroId, UUID itemId) {
        return items.findByIdAndHeroId(itemId, heroId)
                .orElseThrow(() -> new ApiException(HeroErrorCode.HERO_GALLERY_ITEM_NOT_FOUND,
                        "The image is not in this hero's gallery."));
    }

    private static String kind(@Nullable String value) {
        if (value == null || !ACCEPTED.containsKey(value)) {
            throw HeroValidation.invalid("The gallery kind must be HERO_ART, SKIN, SKILL, STICKER or OTHER.");
        }
        return value;
    }

    private void requireAsset(UUID assetId, String kind) {
        var asset = media.find(assetId)
                .orElseThrow(() -> new ApiException(HeroErrorCode.HERO_INVALID_MEDIA, "The image does not exist."));
        if (!asset.usable()) {
            throw new ApiException(HeroErrorCode.HERO_INVALID_MEDIA, "The image is not active or has no file yet.");
        }
        if (!ACCEPTED.get(kind).contains(asset.semanticType())) {
            throw new ApiException(HeroErrorCode.HERO_INVALID_MEDIA,
                    "A " + kind + " gallery image cannot be a " + asset.semanticType() + " asset.");
        }
    }

    private static @Nullable String caption(@Nullable String value) {
        String caption = value == null ? "" : value.strip();
        if (caption.length() > 500) {
            throw HeroValidation.invalid("A gallery caption has at most 500 characters.");
        }
        return caption.isEmpty() ? null : caption;
    }

    private static @Nullable String partKey(@Nullable String value) {
        String key = value == null ? "" : value.strip();
        if (key.length() > 64) {
            throw HeroValidation.invalid("A part key has at most 64 characters.");
        }
        return key.isEmpty() ? null : key;
    }

    private void requirePatch(@Nullable UUID variantId) {
        if (variantId == null) {
            return;
        }
        try {
            contexts.variant(variantId);
        } catch (ApiException missing) {
            throw HeroValidation.invalid("The patch the image belongs before does not exist.");
        }
    }

    /** Names of skills and skins, from the newest version that names them, in the reader's language when it can. */
    private Map<String, String> partNames(List<HeroGalleryImagesRepository.VersionImage> rows, String locale) {
        if (rows.isEmpty()) {
            return Map.of();
        }

        Map<UUID, Long> order = new HashMap<>();
        rows.forEach(row -> order.put(row.getRevisionId(), row.getRevisionNo()));
        List<PartName> all = new ArrayList<>(names.skillNames(order.keySet()));
        all.addAll(names.skinNames(order.keySet()));
        Comparator<PartName> preference = Comparator
                .comparing((PartName name) -> -order.getOrDefault(name.getRevisionId(), 0L))
                .thenComparing(CatalogLocales.preference(locale, PartName::getLocale));

        Map<String, String> result = new HashMap<>();
        all.stream().sorted(preference).forEach(name -> result.putIfAbsent(name.getPartKey(), name.getName()));
        return result;
    }

    /** In use first, then drafts, then older versions with the newest first, then attached images in their order. */
    private static final Comparator<Image> ORDER = Comparator.comparingInt(HeroGallery::rank)
            .thenComparing(image -> -image.versions().stream().mapToLong(Version::revisionNo).max().orElse(0))
            .thenComparingInt(image -> image.attachment() == null ? 0 : image.attachment().sortOrder());

    private static int rank(Image image) {
        if (image.current()) {
            return 0;
        }
        if (image.versions().stream().anyMatch(version -> version.state() == RevisionState.DRAFT)) {
            return 1;
        }
        return image.versions().isEmpty() ? 3 : 2;
    }

    private static final class Builder {
        private final UUID assetId;
        private final Set<String> roles = new LinkedHashSet<>();
        private final Map<UUID, Version> versions = new LinkedHashMap<>();
        private @Nullable String kind;
        private @Nullable String partKey;
        private boolean current;
        private @Nullable Attachment attachment;

        private Builder(UUID assetId) {
            this.assetId = assetId;
        }

        private void place(String role) {
            roles.add(role);
            int colon = role.indexOf(':');
            if (kind == null) {
                kind = role.startsWith("SKIN_")
                        ? "SKIN"
                        : role.startsWith("SKILL_")
                                ? "SKILL"
                                : role.equals("GALLERY") ? null : "HERO_ART";
            }
            if (partKey == null && colon > 0) {
                partKey = role.substring(colon + 1);
            }
        }

        private Image build(Map<String, String> partNames) {
            var newestFirst = versions.values().stream()
                    .sorted(Comparator.comparingLong(Version::revisionNo).reversed()).toList();
            return new Image(assetId, kind == null ? "OTHER" : kind, List.copyOf(roles), partKey,
                    partKey == null ? null : partNames.get(partKey), current, newestFirst, attachment);
        }
    }
}
