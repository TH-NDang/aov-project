package com.wikiaov.terminology.internal.application.service;

import com.wikiaov.access.*;
import com.wikiaov.platform.ApiException;
import com.wikiaov.terminology.internal.application.ReferenceErrorCode;
import com.wikiaov.terminology.internal.application.response.ReferenceSettingsView;
import com.wikiaov.terminology.internal.domain.ReferenceSettings;
import com.wikiaov.terminology.internal.domain.ReferenceSettings.*;
import com.wikiaov.terminology.internal.persistence.*;
import com.wikiaov.terminology.internal.persistence.entity.*;
import java.time.Clock;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class ReferenceCatalog {
    private final ReferenceConfigurationRepository configurations;
    private final ReferenceEntryRepository entries;
    private final ReferenceTranslationRepository translations;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;
    public ReferenceCatalog(ReferenceConfigurationRepository configurations, ReferenceEntryRepository entries,
            ReferenceTranslationRepository translations, CurrentActor actors, AuditLog audit, Clock clock) {
        this.configurations = configurations;
        this.entries = entries;
        this.translations = translations;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ReferenceSettingsView readPublic() {
        var view = readSnapshot();
        var config = view.settings();
        return new ReferenceSettingsView(view.version(), new ReferenceSettings(1, config.autoRecognize(),
                config.fallbackLocale(), config.entities().stream().filter(e -> e.kind().equals("term")).toList())
                .publicView());
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ReferenceSettingsView readCatalogConfiguration() {
        var view = readSnapshot();
        return new ReferenceSettingsView(view.version(), view.settings().publicView());
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ReferenceSettingsView readAdmin() {
        return readSnapshot();
    }

    @PreAuthorize("hasAuthority('hero:write')")
    @Transactional
    public ReferenceSettingsView save(long expectedVersion, ReferenceSettings input) {
        try {
            input.validate();
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new ApiException(ReferenceErrorCode.REFERENCE_INVALID_SETTINGS, "Invalid reference settings.");
        }
        var config = configurations.lockById(ReferenceConfiguration.ID).orElseThrow();
        if (config.getVersion() != expectedVersion)
            throw new ApiException(ReferenceErrorCode.REFERENCE_VERSION_CONFLICT,
                    "Reference settings have changed. Reload before saving.",
                    Map.of("currentVersion", config.getVersion()));
        translations.deleteAllInBatch();
        entries.deleteAllInBatch();
        var entryRows = new ArrayList<ReferenceEntry>();
        var translationRows = new ArrayList<ReferenceTranslation>();
        for (int index = 0; index < input.entities().size(); index++) {
            var value = input.entities().get(index);
            var row = new ReferenceEntry();
            row.setId(UUID.randomUUID());
            row.setReferenceKey(value.id());
            row.setKind(value.kind());
            row.setDisplayOrder(index);
            row.setIcon(value.icon());
            row.setAutoMatch(value.autoMatch());
            row.setDisplay(value.display());
            row.setDestinations(value.destinations());
            entryRows.add(row);
            for (var text : value.translations()) {
                var copy = new ReferenceTranslation();
                copy.setId(UUID.randomUUID());
                copy.setEntryId(row.getId());
                copy.setLocale(text.locale());
                copy.setName(text.name());
                copy.setDescription(text.description());
                copy.setAliases(text.aliases());
                translationRows.add(copy);
            }
        }
        entries.saveAllAndFlush(entryRows);
        translations.saveAllAndFlush(translationRows);
        long before = config.getVersion();
        config.setVersion(before + 1);
        config.setAutoRecognize(input.autoRecognize());
        config.setFallbackLocale(input.fallbackLocale());
        config.setUpdatedAt(clock.instant());
        configurations.saveAndFlush(config);
        audit.record(new AuditEntry(actors.require(), "REFERENCE_SETTINGS_UPDATED", "REFERENCE_SETTINGS",
                config.getId(), null, before, config.getVersion(), null,
                Map.of("entryCount", input.entities().size())));
        return new ReferenceSettingsView(config.getVersion(), input);
    }
    private ReferenceSettingsView readSnapshot() {
        var config = configurations.findById(ReferenceConfiguration.ID).orElseThrow();
        var copies = translations.findAll().stream().collect(Collectors.groupingBy(ReferenceTranslation::getEntryId));
        var values = entries.findAllByOrderByDisplayOrderAsc().stream().map(e -> new Entry(e.getReferenceKey(),
                e.getKind(),
                copies.getOrDefault(e.getId(), List.of()).stream()
                        .sorted(Comparator.comparing(ReferenceTranslation::getLocale))
                        .map(t -> new Translation(t.getLocale(), t.getName(), t.getAliases(), t.getDescription()))
                        .toList(),
                e.getIcon(), e.getAutoMatch(), e.getDisplay(), e.getDestinations())).toList();
        return new ReferenceSettingsView(config.getVersion(),
                new ReferenceSettings(1, config.isAutoRecognize(), config.getFallbackLocale(), values));
    }
}
