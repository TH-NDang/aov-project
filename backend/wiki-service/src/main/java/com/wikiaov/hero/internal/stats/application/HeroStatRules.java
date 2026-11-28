package com.wikiaov.hero.internal.stats.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.stats.persistence.HeroStatRuleRepository;
import com.wikiaov.hero.internal.stats.persistence.entity.HeroStatRule;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogAggregates;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Clock;
import java.util.HashMap;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What every hero shares for a stat, whatever the patch (owner, 2026-11-28): the level 1 value all heroes start with,
 * the rise per level they share and the most the stat reaches in a match. A hero records its own value only where it
 * differs.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class HeroStatRules {
    private static final Set<String> UNITS = Set.of("POINT", "PERCENT");
    private static final Set<String> WITH_PERCENT = Set.of("ARMOR", "MAGIC_DEFENSE", "ARMOR_PIERCE", "MAGIC_PIERCE");

    private final HeroStatRuleRepository rules;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    public record StatRuleView(
            String statKey,
            String unit,
            BigDecimal baseValue,
            BigDecimal percentValue,
            BigDecimal growthPerLevel,
            BigDecimal capValue,
            String sourceUrl,
            long version
    ) {
    }

    public record SetStatRule(
            String unit,
            BigDecimal baseValue,
            BigDecimal percentValue,
            BigDecimal growthPerLevel,
            BigDecimal capValue,
            String sourceUrl,
            Long expectedVersion
    ) {
    }

    @Transactional(readOnly = true)
    public List<StatRuleView> published() {
        return rules.findAllByOrderByStatKey().stream().map(HeroStatRules::view).toList();
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<StatRuleView> list() {
        return published();
    }

    @PreAuthorize("hasAuthority('hero:write')")
    public StatRuleView set(String key, SetStatRule input) {
        validate(key, input);
        var row = rules.findByStatKey(key).orElseGet(HeroStatRule::new);
        if (row.getVersion() != input.expectedVersion()) {
            throw new ApiException(HeroErrorCode.HERO_STAT_RULE_CONFLICT,
                    "The shared stat has changed. Reload before saving.");
        }
        if (row.getId() == null) {
            row.setId(UUID.randomUUID());
            row.setStatKey(key);
        }
        var before = view(row);
        row.setUnit(input.unit());
        row.setBaseValue(input.baseValue());
        row.setPercentValue(input.percentValue());
        row.setGrowthPerLevel(input.growthPerLevel());
        row.setCapValue(input.capValue());
        row.setSourceUrl(blankToNull(input.sourceUrl()));
        row.setVersion(row.getVersion() + 1);
        row.setUpdatedAt(clock.instant());
        rules.saveAndFlush(row);
        record("HERO_STAT_RULE_SET", row, input.expectedVersion(), before);
        return view(row);
    }

    @PreAuthorize("hasAuthority('hero:write')")
    public void remove(String key, long expectedVersion) {
        var row = rules.findByStatKey(key).orElseThrow(
                () -> new ApiException(HeroErrorCode.HERO_STAT_RULE_NOT_FOUND, "The shared stat was not found."));
        if (row.getVersion() != expectedVersion) {
            throw new ApiException(HeroErrorCode.HERO_STAT_RULE_CONFLICT,
                    "The shared stat has changed. Reload before saving.");
        }
        var before = view(row);
        rules.delete(row);
        rules.flush();
        record("HERO_STAT_RULE_REMOVED", row, expectedVersion, before);
    }

    private void record(String action, HeroStatRule row, long expected, StatRuleView before) {
        var metadata = new HashMap<String, Object>();
        metadata.put("statKey", row.getStatKey());
        if (before.version() > 0) {
            metadata.put("before", summary(before));
        }
        if (!action.endsWith("REMOVED")) {
            metadata.put("after", summary(view(row)));
        }
        audit.record(new AuditEntry(actors.require(), action, CatalogAggregates.HERO_STAT_RULE, row.getId(), null,
                expected, action.endsWith("REMOVED") ? null : row.getVersion(), null, metadata));
    }

    private static String summary(StatRuleView rule) {
        return "base=" + rule.baseValue() + " percent=" + rule.percentValue() + " growth=" + rule.growthPerLevel()
                + " cap=" + rule.capValue() + " unit=" + rule.unit();
    }

    private static StatRuleView view(HeroStatRule row) {
        return new StatRuleView(row.getStatKey(), row.getUnit(), row.getBaseValue(), row.getPercentValue(),
                row.getGrowthPerLevel(), row.getCapValue(), row.getSourceUrl(), row.getVersion());
    }

    private static void validate(String key, SetStatRule input) {
        if (key == null || !key.matches("[A-Z][A-Z0-9_]{0,63}") || input == null || input.unit() == null
                || !UNITS.contains(input.unit()) || input.expectedVersion() == null || input.expectedVersion() < 0) {
            throw invalid("Provide a stat key, a unit (POINT or PERCENT) and the expected version.");
        }
        if (input.baseValue() == null && input.growthPerLevel() == null && input.capValue() == null) {
            throw invalid("A shared stat needs a level 1 value, a rise per level or a cap.");
        }
        for (var number : new BigDecimal[] {input.baseValue(), input.percentValue(), input.growthPerLevel(),
                input.capValue()}) {
            if (number != null && (number.precision() > 18 || Math.abs((long) number.scale()) > 12)) {
                throw invalid("A number has too many digits.");
            }
        }
        if (input.baseValue() != null && input.baseValue().signum() < 0
                || input.growthPerLevel() != null && input.growthPerLevel().signum() < 0) {
            throw invalid("A shared value cannot be negative.");
        }
        if (input.capValue() != null && input.capValue().signum() <= 0) {
            throw invalid("A cap must be above zero.");
        }
        if (input.percentValue() != null && (!WITH_PERCENT.contains(key) || input.baseValue() == null
                || input.percentValue().signum() < 0 || input.percentValue().compareTo(BigDecimal.valueOf(100)) > 0)) {
            throw invalid("Only armor, magic defense and both pierces show a percent from 0 to 100, after a number.");
        }
        if (input.capValue() != null && input.baseValue() != null
                && input.baseValue().compareTo(input.capValue()) > 0) {
            throw invalid("The level 1 value cannot be above the cap.");
        }
        if (!validSource(blankToNull(input.sourceUrl()))) {
            throw invalid("The source must be an http(s) address.");
        }
    }

    private static ApiException invalid(String message) {
        return new ApiException(HeroErrorCode.HERO_INVALID_CONTENT, message);
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text.trim();
    }

    private static boolean validSource(String text) {
        if (text == null) {
            return true;
        }
        if (text.length() > 2048) {
            return false;
        }
        try {
            var uri = URI.create(text);
            return ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }
}
