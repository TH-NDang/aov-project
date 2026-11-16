package com.wikiaov.spell.internal.catalog.infrastructure;

import com.wikiaov.build.BuildReference;
import com.wikiaov.build.BuildReferenceKind;
import com.wikiaov.build.BuildReferenceProvider;
import com.wikiaov.spell.internal.catalog.persistence.SpellIdentityRepository;
import com.wikiaov.spell.internal.catalog.persistence.SpellRevisionRepository;
import com.wikiaov.spell.internal.catalog.persistence.entity.SpellIdentity;
import com.wikiaov.spell.internal.catalog.persistence.entity.SpellRevision;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Tells the build module (ADR-026) which spells exist with a published revision. */
@Component
@RequiredArgsConstructor
public class SpellBuildReferences implements BuildReferenceProvider {
    private final SpellIdentityRepository identities;
    private final SpellRevisionRepository revisions;

    public BuildReferenceKind kind() {
        return BuildReferenceKind.SPELL;
    }

    @Transactional(readOnly = true)
    public Map<String, BuildReference> byCodes(Collection<String> codes) {
        Map<String, BuildReference> result = new HashMap<>();
        for (var identity : published(identities.findByCodeIn(codes)))
            result.put(identity.getCode(), reference(identity));
        return result;
    }

    @Transactional(readOnly = true)
    public Map<UUID, BuildReference> byIds(Collection<UUID> ids) {
        Map<UUID, BuildReference> result = new HashMap<>();
        for (var identity : published(identities.findAllById(ids)))
            result.put(identity.getId(), reference(identity));
        return result;
    }

    /** The given identities that have a published revision. */
    private List<SpellIdentity> published(List<SpellIdentity> found) {
        if (found.isEmpty())
            return List.of();
        Set<UUID> published = revisions
                .findByOwnerIdInAndState(found.stream().map(SpellIdentity::getId).toList(), "PUBLISHED").stream()
                .map(SpellRevision::getOwnerId).collect(Collectors.toSet());
        return found.stream().filter(identity -> published.contains(identity.getId())).toList();
    }

    private static BuildReference reference(SpellIdentity identity) {
        return BuildReference.of(identity.getId(), identity.getCode());
    }
}
