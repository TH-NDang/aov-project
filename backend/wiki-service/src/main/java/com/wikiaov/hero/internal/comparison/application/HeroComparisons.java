package com.wikiaov.hero.internal.comparison.application;

import com.wikiaov.hero.internal.application.response.HeroComparisonView;
import com.wikiaov.hero.internal.application.response.HeroComparisonView.Difference;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
@Transactional(readOnly = true)
public class HeroComparisons {
    private final HeroStore store;
    private final HeroSections sections;
    private final JsonMapper json;

    public HeroComparisons(HeroStore store, HeroSections sections, JsonMapper json) {
        this.store = store;
        this.sections = sections;
        this.json = json;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public HeroComparisonView compare(UUID heroId, UUID revisionId, UUID fromRevisionId) {
        var target = store.revision(heroId, revisionId);
        var after = content(target);
        UUID sourceId = fromRevisionId == null ? target.sourceRevisionId() : fromRevisionId;
        if (sourceId == null)
            return new HeroComparisonView("BASELINE_ONLY", null, target, Map.of(), after, List.of(), List.of(
                    "No earlier snapshot was supplied. This is an observed baseline, not evidence of a gameplay change."));
        var source = store.revision(heroId, sourceId);
        if (!source.rulesetId().equals(target.rulesetId()))
            throw HeroValidation.invalid("Compare revisions from the same hero and ruleset.");
        var before = content(source);
        List<Difference> changes = new ArrayList<>();
        for (var section : HeroSection.values()) {
            Object previous = normalized(before.get(section));
            Object current = normalized(after.get(section));
            difference(section, "", previous, current, changes);
        }
        return new HeroComparisonView("AVAILABLE", source, target, before, after, List.copyOf(changes), List.of(
                "Snapshot differences do not establish which patch caused a change. Review sources before recording a changelog."));
    }

    private Map<HeroSection, Object> content(HeroRevisionView revision) {
        Map<HeroSection, Object> result = new EnumMap<>(HeroSection.class);
        revision.sections().forEach((section, id) -> result.put(section, sections.content(section, id)));
        return result;
    }

    private Object normalized(Object value) {
        return value == null ? null : json.convertValue(value, Object.class);
    }

    private static void difference(HeroSection section, String path, Object before, Object after,
            List<Difference> result) {
        if (same(before, after))
            return;
        if (section == HeroSection.SKILLS && path.endsWith("/effects")
                && before instanceof List<?> left && after instanceof List<?> right) {
            before = comparableEffects(left);
            after = comparableEffects(right);
            if (same(before, after))
                return;
        }
        if (before instanceof Map<?, ?> left && after instanceof Map<?, ?> right) {
            Set<String> keys = new TreeSet<>();
            left.keySet().forEach(key -> keys.add(key.toString()));
            right.keySet().forEach(key -> keys.add(key.toString()));
            for (String key : keys) {
                if (key.equals("sources"))
                    continue;
                difference(section, path + "/" + escape(key), left.get(key), right.get(key), result);
            }
            return;
        }
        if (before instanceof List<?> left && after instanceof List<?> right) {
            String key = identityKey(path);
            if (key != null) {
                var leftByKey = index(left, key);
                var rightByKey = index(right, key);
                if (leftByKey != null && rightByKey != null) {
                    Set<String> identities = new TreeSet<>(leftByKey.keySet());
                    identities.addAll(rightByKey.keySet());
                    for (String identity : identities)
                        difference(section, path + "/" + escape(identity), leftByKey.get(identity),
                                rightByKey.get(identity), result);
                    return;
                }
            }
            if (path.equals("/roles") && new HashSet<>(left).equals(new HashSet<>(right)))
                return;
        }
        result.add(new Difference(section, path.isEmpty() ? "/" : path,
                before == null ? "ADDED" : after == null ? "REMOVED" : "CHANGED", before, after));
    }

    /** Capture evidence is retained in responses, but only observed skill data participates in comparison. */
    private static List<Object> comparableEffects(List<?> effects) {
        List<Object> result = new ArrayList<>();
        for (Object value : effects) {
            if (value instanceof Map<?, ?> effect && "SOURCE_SNAPSHOT".equals(effect.get("effectType"))) {
                Map<String, Object> gameplay = new LinkedHashMap<>();
                if (effect.get("metadata") instanceof Map<?, ?> metadata) {
                    for (String key : List.of("cooldown", "energyCost", "levelTable", "tags")) {
                        Object observed = comparisonValue(metadata.get(key), true);
                        if (meaningful(observed))
                            gameplay.put(key, observed);
                    }
                }
                if (!gameplay.isEmpty())
                    result.add(Map.of("effectType", "SOURCE_SNAPSHOT", "metadata", gameplay));
            } else {
                result.add(comparisonValue(value, false));
            }
        }
        return result;
    }

    private static Object comparisonValue(Object value, boolean capture) {
        if (value instanceof Map<?, ?> object) {
            Map<String, Object> result = new LinkedHashMap<>();
            object.forEach((key, item) -> {
                if (!capture || !Set.of("review_required", "reviewRequired").contains(key.toString()))
                    result.put(key.toString(), comparisonValue(item, capture));
            });
            return result;
        }
        if (value instanceof List<?> values)
            return values.stream().map(item -> comparisonValue(item, capture)).toList();
        if (value instanceof Number number)
            return new BigDecimal(number.toString()).stripTrailingZeros();
        return value;
    }

    private static boolean meaningful(Object value) {
        if (value instanceof Map<?, ?> object)
            return object.values().stream().anyMatch(HeroComparisons::meaningful);
        if (value instanceof List<?> values)
            return values.stream().anyMatch(HeroComparisons::meaningful);
        if (value instanceof String text)
            return !text.isBlank();
        return value != null;
    }

    private static String identityKey(String path) {
        if (path.endsWith("/translations"))
            return "locale";
        if (path.endsWith("/effects"))
            return "effectType";
        return switch (path) {
            case "/skills" -> "skillKey";
            case "/skins" -> "skinKey";
            case "/values" -> "statKey";
            default -> null;
        };
    }

    private static Map<String, Object> index(List<?> values, String key) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (Object value : values) {
            if (!(value instanceof Map<?, ?> object) || object.get(key) == null)
                return null;
            if (result.put(object.get(key).toString(), value) != null)
                return null;
        }
        return result;
    }

    private static String escape(String value) {
        return value.replace("~", "~0").replace("/", "~1");
    }

    private static boolean same(Object before, Object after) {
        if (before instanceof Number a && after instanceof Number b)
            return new BigDecimal(a.toString()).compareTo(new BigDecimal(b.toString())) == 0;
        return Objects.equals(before, after);
    }
}
