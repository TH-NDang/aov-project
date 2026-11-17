package com.wikiaov.enchantment.internal.metadata.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.enchantment.internal.application.EnchantmentBranchCommand;
import com.wikiaov.enchantment.internal.application.EnchantmentErrorCode;
import com.wikiaov.enchantment.internal.application.EnchantmentOrdering;
import com.wikiaov.enchantment.internal.application.response.EnchantmentBranchView;
import com.wikiaov.enchantment.internal.metadata.persistence.EnchantmentBranchRepository;
import com.wikiaov.enchantment.internal.metadata.persistence.EnchantmentBranchTranslationRepository;
import com.wikiaov.enchantment.internal.metadata.persistence.entity.EnchantmentBranch;
import com.wikiaov.enchantment.internal.metadata.persistence.entity.EnchantmentBranchTranslation;
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
public class EnchantmentBranchCatalog implements MediaUsageProvider {
    private final EnchantmentBranchRepository records;
    private final EnchantmentBranchTranslationRepository translations;
    private final MediaAssets media;
    private final CurrentActor actors;
    private final AuditLog audit;

    public EnchantmentBranchCatalog(EnchantmentBranchRepository records,
            EnchantmentBranchTranslationRepository translations, MediaAssets media, CurrentActor actors,
            AuditLog audit) {
        this.records = records;
        this.translations = translations;
        this.media = media;
        this.actors = actors;
        this.audit = audit;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<EnchantmentBranchView> list() {
        return records.findAllByOrderByDisplayOrderAscCodeAsc().stream().map(this::view).toList();
    }

    @PreAuthorize("hasAuthority('enchantment:write')")
    public EnchantmentBranchView save(String code, EnchantmentBranchCommand input) {
        if (!code.matches(CatalogCodes.PATTERN) || code.length() > 120)
            invalid("Invalid metadata code.");
        var found = records.lockByCode(code);
        var row = found.orElseGet(() -> {
            var e = new EnchantmentBranch();
            e.setCode(code);
            return e;
        });
        if (row.getVersion() != input.expectedVersion())
            throw new ApiException(EnchantmentErrorCode.ENCHANTMENT_CONFLICT, "The metadata record has changed.",
                    Map.of("currentVersion", row.getVersion()));
        var locales = new HashSet<String>();
        for (var t : input.translations())
            if (t.locale() == null || !t.locale().matches(CatalogLocales.PATTERN) || !locales.add(t.locale())
                    || t.name() == null || t.name().isBlank() || t.name().length() > 255
                    || t.description() != null && t.description().length() > 32768
                    || t.suitability() != null && t.suitability().length() > 4000)
                invalid("Invalid metadata translation.");
        asset(input.iconAssetId(), MediaSemanticType.ENCHANTMENT_ICON);
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
            var e = new EnchantmentBranchTranslation();
            e.setId(UUID.randomUUID());
            e.setOwnerCode(code);
            e.setLocale(t.locale());
            e.setName(t.name());
            e.setDescription(t.description());
            e.setSuitability(t.suitability());
            translations.save(e);
        }
        translations.flush();
        audit.record(
                new AuditEntry(actors.require(), "ENCHANTMENT_METADATA_UPDATED", CatalogAggregates.ENCHANTMENT_METADATA,
                        UUID.nameUUIDFromBytes(code.getBytes(java.nio.charset.StandardCharsets.UTF_8)), null, before,
                        row.getVersion(), null, Map.of("code", code)));
        return view(row);
    }

    @Transactional(readOnly = true)
    public List<MediaUsage> findUsages(UUID assetId) {
        return findAllUsages().getOrDefault(assetId, List.of());
    }

    @Transactional(readOnly = true)
    public Map<UUID, List<MediaUsage>> findAllUsages() {
        Map<UUID, List<MediaUsage>> usages = new HashMap<>();
        for (var record : records.findAll()) {
            var owner = UUID.nameUUIDFromBytes(record.getCode().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            if (record.getIconAssetId() != null)
                usages.computeIfAbsent(record.getIconAssetId(), ignored -> new ArrayList<>()).add(new MediaUsage(
                        "ENCHANTMENT", "ENCHANTMENT_METADATA", owner, null, "ICON", MediaUsageScope.CURRENT)
                        .named(record.getCode(),
                                null));
            if (record.getBackgroundAssetId() != null)
                usages.computeIfAbsent(record.getBackgroundAssetId(), ignored -> new ArrayList<>()).add(new MediaUsage(
                        "ENCHANTMENT", "ENCHANTMENT_METADATA", owner, null, "BACKGROUND", MediaUsageScope.CURRENT)
                        .named(record.getCode(), null));
        }

        return usages;
    }

    @PreAuthorize("hasAuthority('enchantment:write')")
    public List<EnchantmentBranchView> reorder(EnchantmentOrdering.Branches input) {
        var codes = input.entries().stream().map(EnchantmentOrdering.Branch::code).toList();
        if (new HashSet<>(codes).size() != codes.size())
            invalid("Duplicate branch codes are not allowed.");
        var locked = new HashMap<String, EnchantmentBranch>();
        codes.stream().sorted().forEach(code -> locked.put(code, records.lockByCode(code)
                .orElseThrow(() -> new ApiException(EnchantmentErrorCode.ENCHANTMENT_CONFLICT,
                        "The branch list has changed. Reload before reordering."))));
        if (!new HashSet<>(codes).equals(records.findAll().stream().map(EnchantmentBranch::getCode)
                .collect(java.util.stream.Collectors.toSet())))
            throw new ApiException(EnchantmentErrorCode.ENCHANTMENT_CONFLICT,
                    "The branch list has changed. Reload before reordering.");
        for (var entry : input.entries())
            if (locked.get(entry.code()).getVersion() != entry.expectedVersion())
                throw new ApiException(EnchantmentErrorCode.ENCHANTMENT_CONFLICT, "The branch has changed.");
        for (int index = 0; index < codes.size(); index++) {
            var row = locked.get(codes.get(index));
            if (row.getDisplayOrder() == index)
                continue;
            long before = row.getVersion();
            row.setDisplayOrder(index);
            row.setVersion(before + 1);
            records.saveAndFlush(row);
            audit.record(new AuditEntry(actors.require(), "ENCHANTMENT_BRANCH_REORDERED",
                    CatalogAggregates.ENCHANTMENT_METADATA,
                    UUID.nameUUIDFromBytes(row.getCode().getBytes(java.nio.charset.StandardCharsets.UTF_8)), null,
                    before, row.getVersion(), null, Map.of("code", row.getCode(), "displayOrder", index)));
        }
        return codes.stream().map(code -> view(locked.get(code))).toList();
    }

    private EnchantmentBranchView view(EnchantmentBranch e) {
        return new EnchantmentBranchView(e.getCode(), e.getVersion(), e.getDisplayOrder(), e.getIconAssetId(),
                e.getBackgroundAssetId(), e.getColor(),
                translations.findByOwnerCodeOrderByLocale(e.getCode()).stream()
                        .map(t -> new MetadataTranslation(t.getLocale(), t.getName(), t.getDescription(),
                                t.getSuitability()))
                        .toList());
    }

    private void asset(UUID id, MediaSemanticType type) {
        if (id != null && media.find(id).filter(a -> a.usable() && a.semanticType() == type).isEmpty())
            invalid("The metadata asset must be uploaded and match its semantic type.");
    }

    private static void invalid(String detail) {
        throw new ApiException(EnchantmentErrorCode.ENCHANTMENT_INVALID_CONTENT, detail);
    }
}
