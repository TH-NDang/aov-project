package com.wikiaov.item.internal.metadata.application;

import com.wikiaov.item.internal.application.response.PublicItemCategoryView;
import com.wikiaov.item.internal.metadata.persistence.ItemCategoryRepository;
import com.wikiaov.item.internal.metadata.persistence.ItemCategoryTranslationRepository;
import com.wikiaov.item.internal.metadata.persistence.entity.ItemCategoryTranslation;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogText.MetadataTranslation;
import com.wikiaov.platform.PlatformErrorCode;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PublicItemCategoryCatalog {
    private final ItemCategoryRepository records;
    private final ItemCategoryTranslationRepository translations;
    private final MediaAssets media;

    public PublicItemCategoryCatalog(ItemCategoryRepository records, ItemCategoryTranslationRepository translations,
            MediaAssets media) {
        this.records = records;
        this.translations = translations;
        this.media = media;
    }

    public List<PublicItemCategoryView> read(String locale) {
        if (locale == null || !locale.matches("[a-z]{2,3}(?:-[A-Z]{2})?"))
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, "Invalid metadata locale.");

        var rows = records.findAllByOrderByDisplayOrderAscCodeAsc();
        if (rows.isEmpty())
            return List.of();
        var codes = rows.stream().map(row -> row.getCode()).toList();
        var copies = translations.findByOwnerCodeInOrderByLocale(codes).stream()
                .collect(Collectors.groupingBy(ItemCategoryTranslation::getOwnerCode));
        var ids = new HashSet<UUID>();
        rows.forEach(row -> {
            if (row.getIconAssetId() != null)
                ids.add(row.getIconAssetId());
            if (row.getBackgroundAssetId() != null)
                ids.add(row.getBackgroundAssetId());
        });
        var assets = ids.isEmpty() ? Map.<UUID, MediaAssetReference>of() : media.findAll(ids);

        return rows.stream().map(row -> new PublicItemCategoryView(row.getCode(), row.getDisplayOrder(), row.getColor(),
                select(copies.getOrDefault(row.getCode(), List.of()), locale), usable(assets, row.getIconAssetId()),
                usable(assets, row.getBackgroundAssetId()))).toList();
    }

    private static List<MetadataTranslation> select(List<ItemCategoryTranslation> values, String locale) {
        return values.stream()
                .min(Comparator.comparingInt((ItemCategoryTranslation value) -> value.getLocale().equals(locale)
                        ? 0
                        : value.getLocale().equals("vi-VN") ? 1 : value.getLocale().equals("en-US") ? 2 : 3)
                        .thenComparing(ItemCategoryTranslation::getLocale))
                .map(value -> List.of(new MetadataTranslation(value.getLocale(), value.getName(),
                        value.getDescription(), value.getSuitability())))
                .orElseGet(List::of);
    }

    private static MediaAssetReference usable(Map<UUID, MediaAssetReference> assets, UUID id) {
        var asset = id == null ? null : assets.get(id);
        return asset != null && asset.usable() ? asset : null;
    }
}
