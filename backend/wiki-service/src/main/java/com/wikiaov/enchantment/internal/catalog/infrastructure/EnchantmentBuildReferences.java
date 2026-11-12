package com.wikiaov.enchantment.internal.catalog.infrastructure;

import com.wikiaov.build.BuildReference;
import com.wikiaov.build.BuildReferenceKind;
import com.wikiaov.build.BuildReferenceProvider;
import com.wikiaov.enchantment.internal.catalog.persistence.EnchantmentIdentityRepository;
import com.wikiaov.enchantment.internal.catalog.persistence.EnchantmentRevisionRepository;
import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentIdentity;
import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentRevision;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Tells the build module (ADR-026) which enchantments exist with a published revision, with the facts its rules need. */
@Component
@RequiredArgsConstructor
public class EnchantmentBuildReferences implements BuildReferenceProvider {
    private final EnchantmentIdentityRepository identities;
    private final EnchantmentRevisionRepository revisions;

    public BuildReferenceKind kind() {
        return BuildReferenceKind.ENCHANTMENT;
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
    private List<Published> published(List<EnchantmentIdentity> found) {
        if (found.isEmpty())
            return List.of();
        Map<UUID, EnchantmentRevision> latest = revisions
                .findByOwnerIdInAndState(found.stream().map(EnchantmentIdentity::getId).toList(), "PUBLISHED").stream()
                .collect(Collectors.toMap(EnchantmentRevision::getOwnerId, revision -> revision,
                        (a, b) -> sequence(a) >= sequence(b) ? a : b));
        return found.stream().filter(identity -> latest.containsKey(identity.getId()))
                .map(identity -> new Published(identity, latest.get(identity.getId()))).toList();
    }

    private static long sequence(EnchantmentRevision revision) {
        return revision.getPublicationSequence() == null ? 0 : revision.getPublicationSequence();
    }

    private record Published(
            EnchantmentIdentity identity,
            EnchantmentRevision revision
    ) {
        BuildReference reference() {
            var gameplay = revision.getGameplay();
            return gameplay == null
                    ? BuildReference.of(identity.getId(), identity.getCode())
                    : new BuildReference(identity.getId(), identity.getCode(), null, gameplay.tier(),
                            gameplay.branchCode());
        }
    }
}
