package com.wikiaov.hero.internal.stats.application;

import com.wikiaov.hero.internal.stats.persistence.HeroStatSampleRepository;
import com.wikiaov.patch.GameplayContexts;
import java.math.BigDecimal;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
@RequiredArgsConstructor
public class HeroStatSamples {
    private final GameplayContexts contexts;
    private final HeroStatSampleRepository samples;
    private final JsonMapper json;

    public record BaseStat(
            BigDecimal value,
            String unit,
            BigDecimal percent
    ) {
    }

    public record Capture(
            String patchCode,
            BigDecimal level,
            Map<String, Object> values
    ) {
    }

    public record Sample(
            UUID heroId,
            boolean draft,
            List<String> roles,
            Map<String, BaseStat> baseStats,
            Capture capture
    ) {
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<Sample> forPatch(UUID variantId) {
        var variant = contexts.variant(variantId);
        return samples.samples(variantId, variant.rulesetId()).stream().map(row -> json.readValue(row, Sample.class))
                .toList();
    }
}
