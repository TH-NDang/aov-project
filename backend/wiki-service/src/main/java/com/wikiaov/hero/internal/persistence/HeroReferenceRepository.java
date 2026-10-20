package com.wikiaov.hero.internal.persistence;

import com.wikiaov.patch.GameplayContext;
import com.wikiaov.terminology.AdminReferenceProvider.Row;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Repository;

/** Reads profile copy and head identity without loading revision sections. */
@Repository
public class HeroReferenceRepository {
    private final EntityManager entities;

    public HeroReferenceRepository(EntityManager entities) {
        this.entities = entities;
    }

    public List<Row> authoring(UUID rulesetId) {
        return entities.createQuery("""
                select h.id,r.id,m.assetId,t.locale,t.name,substring(coalesce(t.summary,''),1,4000)
                from HeroIdentity h join HeroRevision r on r.heroId=h.id
                join ProfileTranslationRow t on t.profileRevisionId=r.profileRevisionId
                left join MediaBindingRow m on m.mediaBindingRevisionId=r.mediaBindingRevisionId and m.mediaRole='HEAD'
                where r.rulesetId=:ruleset and r.state<>'DISCARDED' and not exists (
                    select n.id from HeroRevision n where n.heroId=r.heroId and n.rulesetId=r.rulesetId
                    and n.state<>'DISCARDED' and n.revisionNo>r.revisionNo)
                order by h.code,t.locale
                """, Object[].class).setParameter("ruleset", rulesetId).getResultList().stream()
                .map(HeroReferenceRepository::row).toList();
    }

    public List<Row> published(GameplayContext context, Map<UUID, Long> ordinals, Instant at) {
        String rank = ordinal("r", ordinals);
        String newerRank = ordinal("n", ordinals);
        var query = entities.createQuery("""
                select h.id,r.id,m.assetId,t.locale,t.name,substring(coalesce(t.summary,''),1,4000)
                from HeroIdentity h join HeroRevision r on r.heroId=h.id
                join ProfileTranslationRow t on t.profileRevisionId=r.profileRevisionId
                left join MediaBindingRow m on m.mediaBindingRevisionId=r.mediaBindingRevisionId and m.mediaRole='HEAD'
                where r.rulesetId=:ruleset and r.state='PUBLISHED' and r.publishedAt<=:at
                """ + " and " + rank + "<=:cutoff and not exists (select n.id from HeroRevision n "
                + "where n.heroId=r.heroId and n.rulesetId=r.rulesetId and n.state='PUBLISHED' and n.publishedAt<=:at"
                + " and " + newerRank + "<=:cutoff and (" + newerRank + ">" + rank + " or (" + newerRank + "="
                + rank + " and n.publicationSequence>r.publicationSequence))) order by h.code,t.locale", Object[].class)
                .setParameter("ruleset", context.rulesetId()).setParameter("at", at)
                .setParameter("cutoff", context.rulesetOrdinal());
        int index = 0;
        for (var id : new TreeSet<>(ordinals.keySet()))
            query.setParameter("patch" + index++, id);
        return query.getResultList().stream().map(HeroReferenceRepository::row).toList();
    }

    private static Row row(Object[] row) {
        return new Row((UUID) row[0], (UUID) row[1], (UUID) row[2], (String) row[3], (String) row[4], (String) row[5]);
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
