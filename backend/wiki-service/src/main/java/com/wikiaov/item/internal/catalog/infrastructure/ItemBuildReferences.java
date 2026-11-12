package com.wikiaov.item.internal.catalog.infrastructure;

import com.wikiaov.build.BuildReference;
import com.wikiaov.build.BuildReferenceKind;
import com.wikiaov.build.BuildReferenceProvider;
import com.wikiaov.item.internal.catalog.persistence.ItemIdentityRepository;
import com.wikiaov.item.internal.catalog.persistence.ItemRevisionRepository;
import com.wikiaov.item.internal.catalog.persistence.entity.ItemIdentity;
import com.wikiaov.item.internal.catalog.persistence.entity.ItemRevision;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Tells the build module (ADR-026) which items exist with a published revision. */
@Component
@RequiredArgsConstructor
public class ItemBuildReferences implements BuildReferenceProvider {
    private final ItemIdentityRepository identities;
    private final ItemRevisionRepository revisions;

    public BuildReferenceKind kind() {
        return BuildReferenceKind.ITEM;
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
    private List<Published> published(List<ItemIdentity> found) {
        if (found.isEmpty())
            return List.of();
        Map<UUID, ItemRevision> latest = revisions
                .findByOwnerIdInAndState(found.stream().map(ItemIdentity::getId).toList(), "PUBLISHED").stream()
                .collect(Collectors.toMap(ItemRevision::getOwnerId, revision -> revision,
                        (a, b) -> sequence(a) >= sequence(b) ? a : b));
        return found.stream().filter(identity -> latest.containsKey(identity.getId()))
                .map(identity -> new Published(identity, latest.get(identity.getId()))).toList();
    }

    private static long sequence(ItemRevision revision) {
        return revision.getPublicationSequence() == null ? 0 : revision.getPublicationSequence();
    }

    private record Published(
            ItemIdentity identity,
            ItemRevision revision
    ) {
        BuildReference reference() {
            return BuildReference.of(identity.getId(), identity.getCode());
        }
    }
}
