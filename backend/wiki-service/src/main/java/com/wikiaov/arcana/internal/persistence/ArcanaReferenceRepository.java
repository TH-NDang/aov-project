package com.wikiaov.arcana.internal.persistence;

import com.wikiaov.patch.GameplayContext;
import com.wikiaov.platform.CatalogChanges.Kind;
import com.wikiaov.terminology.AdminReferenceProvider.Row;
import jakarta.persistence.EntityManager;
import java.util.*;
import org.springframework.stereotype.Repository;

/** Reads compact reference fields without hydrating gameplay JSON or full translations. */
@Repository
public class ArcanaReferenceRepository {
    private final EntityManager entities;

    public ArcanaReferenceRepository(EntityManager entities) {
        this.entities = entities;
    }

    public List<Row> authoring(UUID rulesetId, Map<UUID, Long> ordinals) {
        return rows(rulesetId, ordinals, false, Long.MAX_VALUE);
    }

    public List<Row> published(GameplayContext context, Map<UUID, Long> ordinals) {
        var rows = rows(context.rulesetId(), ordinals, true, context.rulesetOrdinal());
        var lifecycle = new HashMap<UUID, Object[]>();
        for (var fact : entities.createQuery(
                "select f.ownerId,f.patchVariantId,f.kinds from ArcanaPatchChange f where f.rulesetId=:ruleset",
                Object[].class).setParameter("ruleset", context.rulesetId()).getResultList()) {
            @SuppressWarnings("unchecked")
            var kinds = (List<Kind>) fact[2];
            long ordinal = ordinals.getOrDefault((UUID) fact[1], Long.MAX_VALUE);
            if (ordinal > context.rulesetOrdinal() || !kinds.contains(Kind.ADDED) && !kinds.contains(Kind.REMOVED))
                continue;
            lifecycle.merge((UUID) fact[0], fact,
                    (first, second) -> ordinals.get((UUID) first[1]) >= ordinals.get((UUID) second[1])
                            ? first
                            : second);
        }
        return rows.stream().filter(row -> {
            var fact = lifecycle.get(row.id());
            return fact == null || !((List<?>) fact[2]).contains(Kind.REMOVED);
        }).toList();
    }

    private List<Row> rows(UUID rulesetId, Map<UUID, Long> ordinals, boolean published, long cutoff) {
        String rank = ordinal("r", ordinals);
        String newerRank = ordinal("n", ordinals);
        String state = published ? "state='PUBLISHED'" : "state<>'DISCARDED'";
        String sequence = published ? "coalesce(r.publicationSequence,0)" : "r.revisionNo";
        String newerSequence = published ? "coalesce(n.publicationSequence,0)" : "n.revisionNo";
        String cutoffSql = published ? " and " + rank + "<=:cutoff" : "";
        String newerCutoff = published ? " and " + newerRank + "<=:cutoff" : "";
        var query = entities.createQuery("""
                select i.id,r.id,r.iconAssetId,t.locale,t.name,
                    substring(coalesce(nullif(t.description,''),t.summary,''),1,4000)
                from ArcanaIdentity i join ArcanaRevision r on r.ownerId=i.id
                join ArcanaTranslation t on t.revisionId=r.id
                where r.rulesetId=:ruleset
                """ + " and r." + state + cutoffSql + " and not exists (select n.id from ArcanaRevision n "
                + "where n.ownerId=r.ownerId and n.rulesetId=r.rulesetId and n." + state + newerCutoff
                + " and (" + newerRank + ">" + rank + " or (" + newerRank + "=" + rank + " and "
                + newerSequence + ">" + sequence + "))) order by i.code,t.locale", Object[].class)
                .setParameter("ruleset", rulesetId);
        int index = 0;
        for (var id : new TreeSet<>(ordinals.keySet()))
            query.setParameter("patch" + index++, id);
        if (published)
            query.setParameter("cutoff", cutoff);
        return query.getResultList().stream().map(row -> new Row((UUID) row[0], (UUID) row[1], (UUID) row[2],
                (String) row[3], (String) row[4], (String) row[5])).toList();
    }

    private static String ordinal(String alias, Map<UUID, Long> ordinals) {
        if (ordinals.isEmpty())
            return "0";
        var value = new StringBuilder("(case ").append(alias).append(".effectiveFromPatchVariantId");
        int index = 0;
        for (var id : new TreeSet<>(ordinals.keySet()))
            value.append(" when :patch").append(index++).append(" then ").append(ordinals.get(id));
        return value.append(" else 0 end)").toString();
    }
}
