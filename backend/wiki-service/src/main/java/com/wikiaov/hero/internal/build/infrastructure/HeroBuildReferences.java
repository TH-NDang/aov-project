package com.wikiaov.hero.internal.build.infrastructure;

import com.wikiaov.build.BuildReference;
import com.wikiaov.build.BuildReferenceKind;
import com.wikiaov.build.BuildReferenceProvider;
import com.wikiaov.hero.internal.authoring.persistence.HeroIdentityRepository;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Tells the build module (ADR-026) which heroes and hero forms exist; a legacy code maps to the current hero. */
@Component
@RequiredArgsConstructor
public class HeroBuildReferences implements BuildReferenceProvider {
    private final HeroIdentityRepository heroes;

    @Override
    public BuildReferenceKind kind() {
        return BuildReferenceKind.HERO;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, BuildReference> byCodes(Collection<String> codes) {
        Map<String, BuildReference> result = new HashMap<>();
        heroes.findByCodeIn(codes)
                .forEach(hero -> result.put(hero.getCode(), BuildReference.of(hero.getId(), hero.getCode())));
        for (String code : codes) {
            if (!result.containsKey(code)) {
                heroes.findByCode(code)
                        .ifPresent(hero -> result.put(code, BuildReference.of(hero.getId(), hero.getCode())));
            }
        }
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, BuildReference> byIds(Collection<UUID> ids) {
        Map<UUID, BuildReference> result = new HashMap<>();
        heroes.findAllById(ids)
                .forEach(hero -> result.put(hero.getId(), BuildReference.of(hero.getId(), hero.getCode())));
        return result;
    }
}
