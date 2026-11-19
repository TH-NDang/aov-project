package com.wikiaov.item.internal.metadata.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.item.internal.application.ItemCategoryCommand;
import com.wikiaov.item.internal.application.ItemErrorCode;
import com.wikiaov.item.internal.application.response.ItemCategoryView;
import com.wikiaov.item.internal.metadata.persistence.ItemCategoryRepository;
import com.wikiaov.item.internal.metadata.persistence.ItemCategoryTranslationRepository;
import com.wikiaov.item.internal.metadata.persistence.entity.ItemCategory;
import com.wikiaov.item.internal.metadata.persistence.entity.ItemCategoryTranslation;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageProvider;
import com.wikiaov.media.MediaUsageScope;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogAggregates;
import com.wikiaov.platform.CatalogCodes;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.CatalogText.MetadataTranslation;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ItemCategoryCatalog implements MediaUsageProvider {
    private final ItemCategoryRepository records;
    private final ItemCategoryTranslationRepository translations;
    private final MediaAssets media;
    private final CurrentActor actors;
    private final AuditLog audit;

    public ItemCategoryCatalog(ItemCategoryRepository records, ItemCategoryTranslationRepository translations,
            MediaAssets media, CurrentActor actors, AuditLog audit) {
        this.records = records;
        this.translations = translations;
        this.media = media;
        this.actors = actors;
        this.audit = audit;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<ItemCategoryView> list() {
        return records.findAllByOrderByDisplayOrderAscCodeAsc().stream().map(this::view).toList();
    }

    @PreAuthorize("hasAuthority('item:write')")
    public ItemCategoryView save(String code, ItemCategoryCommand input) {
        if (!code.matches(CatalogCodes.PATTERN) || code.length() > 120) {
            invalid("Invalid metadata code.");
        }

        var found = records.lockByCode(code);
        var row = found.orElseGet(() -> {
            var e = new ItemCategory();
            e.setCode(code);
            return e;
        });
        if (row.getVersion() != input.expectedVersion()) {
            throw new ApiException(ItemErrorCode.ITEM_CONFLICT, "The metadata record has changed.",
                    Map.of("currentVersion", row.getVersion()));
        }

        var locales = new HashSet<String>();
        for (var t : input.translations()) {
            if (t.locale() == null || !t.locale().matches(CatalogLocales.PATTERN) || !locales.add(t.locale())
                    || t.name() == null || t.name().isBlank() || t.name().length() > 255
                    || t.description() != null && t.description().length() > 32768
                    || t.suitability() != null && t.suitability().length() > 4000) {
                invalid("Invalid metadata translation.");
            }
        }
        asset(input.iconAssetId(), MediaSemanticType.ITEM_ICON);
        asset(input.backgroundAssetId(), MediaSemanticType.OTHER);
        long before = row.getVersion();

        row.setVersion(before + 1);
        row.setDisplayOrder(input.displayOrder());
        row.setIconAssetId(input.iconAssetId());
        row.setBackgroundAssetId(input.backgroundAssetId());
        row.setColor(input.color());
        records.saveAndFlush(row);
        translations.deleteByOwnerCode(code);
        translations.flush();
        for (var t : input.translations()) {
            var e = new ItemCategoryTranslation();
            e.setId(UUID.randomUUID());
            e.setOwnerCode(code);
            e.setLocale(t.locale());
            e.setName(t.name());
            e.setDescription(t.description());
            e.setSuitability(t.suitability());
            translations.save(e);
        }
        translations.flush();

        audit.record(new AuditEntry(actors.require(), "ITEM_METADATA_UPDATED", CatalogAggregates.ITEM_METADATA,
                UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8)), null, before,
                row.getVersion(), null, Map.of("code", code)));

        return view(row);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MediaUsage> findUsages(UUID assetId) {
        return findAllUsages().getOrDefault(assetId, List.of());
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, List<MediaUsage>> findAllUsages() {
        Map<UUID, List<MediaUsage>> usages = new HashMap<>();
        for (var record : records.findAll()) {
            var owner = UUID.nameUUIDFromBytes(record.getCode().getBytes(StandardCharsets.UTF_8));
            if (record.getIconAssetId() != null) {
                usages.computeIfAbsent(record.getIconAssetId(), ignored -> new ArrayList<>()).add(new MediaUsage(
                        "ITEM", "ITEM_METADATA", owner, null, "ICON", MediaUsageScope.CURRENT).named(record.getCode(),
                                null));
            }
            if (record.getBackgroundAssetId() != null) {
                usages.computeIfAbsent(record.getBackgroundAssetId(), ignored -> new ArrayList<>()).add(new MediaUsage(
                        "ITEM", "ITEM_METADATA", owner, null, "BACKGROUND", MediaUsageScope.CURRENT)
                        .named(record.getCode(), null));
            }
        }

        return usages;
    }

    private ItemCategoryView view(ItemCategory e) {
        return new ItemCategoryView(e.getCode(), e.getVersion(), e.getDisplayOrder(), e.getIconAssetId(),
                e.getBackgroundAssetId(), e.getColor(),
                translations.findByOwnerCodeOrderByLocale(e.getCode()).stream()
                        .map(t -> new MetadataTranslation(t.getLocale(), t.getName(), t.getDescription(),
                                t.getSuitability()))
                        .toList());
    }

    private void asset(UUID id, MediaSemanticType type) {
        if (id != null && media.find(id).filter(a -> a.usable() && a.semanticType() == type).isEmpty()) {
            invalid("The metadata asset must be uploaded and match its semantic type.");
        }
    }

    private static void invalid(String detail) {
        throw new ApiException(ItemErrorCode.ITEM_INVALID_CONTENT, detail);
    }
}
