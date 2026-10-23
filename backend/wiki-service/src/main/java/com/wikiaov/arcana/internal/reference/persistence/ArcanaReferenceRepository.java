package com.wikiaov.arcana.internal.reference.persistence;

import com.wikiaov.arcana.internal.catalog.persistence.entity.ArcanaRevision;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.platform.CatalogChanges.Kind;
import com.wikiaov.terminology.AdminReferenceProvider.Row;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Reads compact localized references without loading gameplay or mutable entities. */
public interface ArcanaReferenceRepository extends Repository<ArcanaRevision, UUID>, ArcanaReferenceSelections {
    default List<Row> authoring(UUID rulesetId, Map<UUID, Long> ordinals) {
        return selectReferenceRows(rulesetId, ordinals, false, Long.MAX_VALUE);
    }

    default List<Row> published(GameplayContext context, Map<UUID, Long> ordinals) {
        var rows = selectReferenceRows(context.rulesetId(), ordinals, true, context.rulesetOrdinal());

        var lifecycle = new HashMap<UUID, Lifecycle>();
        for (var fact : findLifecycle(context.rulesetId())) {
            long ordinal = ordinals.getOrDefault(fact.getPatchVariantId(), Long.MAX_VALUE);
            if (ordinal > context.rulesetOrdinal()
                    || !fact.getKinds().contains(Kind.ADDED) && !fact.getKinds().contains(Kind.REMOVED))
                continue;

            lifecycle.merge(fact.getOwnerId(), fact,
                    (first, second) -> ordinals.get(first.getPatchVariantId()) >= ordinals
                            .get(second.getPatchVariantId())
                                    ? first
                                    : second);
        }

        return rows.stream().filter(row -> {
            var fact = lifecycle.get(row.id());
            return fact == null || !fact.getKinds().contains(Kind.REMOVED);
        }).toList();
    }

    @Query("""
            select f.ownerId as ownerId, f.patchVariantId as patchVariantId, f.kinds as kinds
            from ArcanaPatchChange f where f.rulesetId = :rulesetId
            """)
    List<Lifecycle> findLifecycle(@Param("rulesetId") UUID rulesetId);

    interface Lifecycle {
        UUID getOwnerId();

        UUID getPatchVariantId();

        List<Kind> getKinds();
    }
}
