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
            result.put(identity.identity().getCode(), identity.reference());
        return result;
    }

    @Transactional(readOnly = true)
    public Map<UUID, BuildReference> byIds(Collection<UUID> ids) {
        Map<UUID, BuildReference> result = new HashMap<>();
        for (var identity : published(identities.findAllById(ids)))
            result.put(identity.identity().getId(), identity.reference());
        return result;
    }

    /** The given identities that have a published revision, each with its latest one. */
    private List<Published> published(List<SpellIdentity> found) {
        if (found.isEmpty())
            return List.of();
        Map<UUID, SpellRevision> latest = revisions
                .findByOwnerIdInAndState(found.stream().map(SpellIdentity::getId).toList(), "PUBLISHED").stream()
                .collect(Collectors.toMap(SpellRevision::getOwnerId, revision -> revision,
                        (a, b) -> sequence(a) >= sequence(b) ? a : b));
        return found.stream().filter(identity -> latest.containsKey(identity.getId()))
                .map(identity -> new Published(identity, latest.get(identity.getId()))).toList();
    }

    private static long sequence(SpellRevision revision) {
        return revision.getPublicationSequence() == null ? 0 : revision.getPublicationSequence();
    }

    private record Published(
            SpellIdentity identity,
            SpellRevision revision
    ) {
        BuildReference reference() {
            return BuildReference.of(identity.getId(), identity.getCode());
        }
    }
}
