package com.wikiaov.terminology.internal.settings.application;

import com.wikiaov.access.*;
import com.wikiaov.platform.ApiException;
import com.wikiaov.terminology.internal.application.ReferenceErrorCode;
import com.wikiaov.terminology.internal.application.response.ReferenceSettingsView;
import com.wikiaov.terminology.internal.domain.ReferenceSettings;
import com.wikiaov.terminology.internal.domain.ReferenceSettings.*;
import com.wikiaov.terminology.internal.settings.persistence.ReferenceConfigurationRepository;
import com.wikiaov.terminology.internal.settings.persistence.entity.ReferenceConfiguration;
import java.time.Clock;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class ReferenceCatalog {
    private final ReferenceConfigurationRepository configurations;
    private final ReferenceSettingsContent content;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    public ReferenceCatalog(ReferenceConfigurationRepository configurations, ReferenceSettingsContent content,
            CurrentActor actors, AuditLog audit, Clock clock) {
        this.configurations = configurations;
        this.content = content;
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
        validateInput(input);

        var config = lockCurrentConfiguration(expectedVersion);

        content.replace(input.entities());
        long before = config.getVersion();
        updateConfiguration(config, input);
        audit.record(new AuditEntry(actors.require(), "REFERENCE_SETTINGS_UPDATED", "REFERENCE_SETTINGS",
                config.getId(), null, before, config.getVersion(), null,
                Map.of("entryCount", input.entities().size())));

        return new ReferenceSettingsView(config.getVersion(), input);
    }

    private static void validateInput(ReferenceSettings input) {
        try {
            input.validate();
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new ApiException(ReferenceErrorCode.REFERENCE_INVALID_SETTINGS, "Invalid reference settings.");
        }
    }

    private ReferenceConfiguration lockCurrentConfiguration(long expectedVersion) {
        var config = configurations.lockById(ReferenceConfiguration.ID).orElseThrow();
        if (config.getVersion() != expectedVersion)
            throw new ApiException(ReferenceErrorCode.REFERENCE_VERSION_CONFLICT,
                    "Reference settings have changed. Reload before saving.",
                    Map.of("currentVersion", config.getVersion()));
        return config;
    }

    private void updateConfiguration(ReferenceConfiguration config, ReferenceSettings input) {
        config.setVersion(config.getVersion() + 1);
        config.setAutoRecognize(input.autoRecognize());
        config.setFallbackLocale(input.fallbackLocale());
        config.setUpdatedAt(clock.instant());
        configurations.saveAndFlush(config);
    }

    private ReferenceSettingsView readSnapshot() {
        var config = configurations.findById(ReferenceConfiguration.ID).orElseThrow();
        var values = content.entries();
        return new ReferenceSettingsView(config.getVersion(),
                new ReferenceSettings(1, config.isAutoRecognize(), config.getFallbackLocale(), values));
    }
}
