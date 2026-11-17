package com.wikiaov.arcana.internal.catalog.infrastructure;

import com.wikiaov.arcana.internal.catalog.persistence.ArcanaIdentityRepository;
import com.wikiaov.arcana.internal.catalog.persistence.ArcanaRevisionRepository;
import com.wikiaov.arcana.internal.catalog.persistence.entity.ArcanaIdentity;
import com.wikiaov.arcana.internal.catalog.persistence.entity.ArcanaRevision;
import com.wikiaov.build.BuildReference;
import com.wikiaov.build.BuildReferenceKind;
import com.wikiaov.build.BuildReferenceProvider;
import com.wikiaov.platform.RevisionState;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Tells the build module (ADR-026) which arcana exist with a published revision, with the facts its rules need. */
@Component
@RequiredArgsConstructor
public class ArcanaBuildReferences implements BuildReferenceProvider {
    private final ArcanaIdentityRepository identities;
    private final ArcanaRevisionRepository revisions;

    public BuildReferenceKind kind() {
        return BuildReferenceKind.ARCANA;
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
    private List<Published> published(List<ArcanaIdentity> found) {
        if (found.isEmpty())
            return List.of();
        Map<UUID, ArcanaRevision> latest = revisions
                .findByOwnerIdInAndState(found.stream().map(ArcanaIdentity::getId).toList(), RevisionState.PUBLISHED)
                .stream()
                .collect(Collectors.toMap(ArcanaRevision::getOwnerId, revision -> revision,
                        (a, b) -> sequence(a) >= sequence(b) ? a : b));
        return found.stream().filter(identity -> latest.containsKey(identity.getId()))
                .map(identity -> new Published(identity, latest.get(identity.getId()))).toList();
    }

    private static long sequence(ArcanaRevision revision) {
        return revision.getPublicationSequence() == null ? 0 : revision.getPublicationSequence();
    }

    private record Published(
            ArcanaIdentity identity,
            ArcanaRevision revision
    ) {
        BuildReference reference() {
            var gameplay = revision.getGameplay();
            return gameplay == null
                    ? BuildReference.of(identity.getId(), identity.getCode())
                    : new BuildReference(identity.getId(), identity.getCode(), gameplay.color(), gameplay.tier(), null);
        }
    }
}
