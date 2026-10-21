package com.wikiaov.hero.internal.persistence;

import com.wikiaov.hero.internal.domain.SkillReferenceSearch;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Repository;

/** Pages skill identities before loading their small localized reference fields. */
@Repository
public class HeroSkillReferenceRepository {
    private final EntityManager entities;
    public HeroSkillReferenceRepository(EntityManager entities) {
        this.entities = entities;
    }
    public record Row(
            UUID heroId,
            String code,
            UUID revisionId,
            UUID profileRevisionId,
            UUID skillSetRevisionId,
            UUID headAssetId,
            String skillKey,
            String formKey,
            UUID iconAssetId
    ) {
    }
    public record Result(
            List<Row> items,
            long totalElements
    ) {
    }
    public record Copy(
            UUID sectionId,
            String skillKey,
            String locale,
            String name,
            String description
    ) {
    }
    public Result search(UUID rulesetId, Map<UUID, Long> ordinals, Instant at, Long cutoff,
            SkillReferenceSearch search, UUID heroId, List<String> ids, int page, int size) {
        String rank = ordinal("r", ordinals), newerRank = ordinal("n", ordinals);
        boolean published = cutoff != null;
        var parameters = new LinkedHashMap<String, Object>();
        parameters.put("ruleset", rulesetId);
        String predicate = " r.rulesetId=:ruleset and r.state" + (published ? "='PUBLISHED'" : "<>'DISCARDED'");
        String newer = "n.heroId=r.heroId and n.rulesetId=r.rulesetId and n.state"
                + (published ? "='PUBLISHED' and n.publishedAt<=:at and " + newerRank + "<=:cutoff" : "<>'DISCARDED'");
        if (published) {
            predicate += " and r.publishedAt<=:at and " + rank + "<=:cutoff";
            parameters.put("at", at);
            parameters.put("cutoff", cutoff);
            int index = 0;
            for (var id : new TreeSet<>(ordinals.keySet()))
                parameters.put("patch" + index++, id);
        }
        String order = published
                ? newerRank + ">" + rank + " or (" + newerRank + "=" + rank
                        + " and n.publicationSequence>r.publicationSequence)"
                : "n.revisionNo>r.revisionNo";
        if (!ids.isEmpty()) {
            var matches = new ArrayList<String>();
            int index = 0;
            for (var id : ids) {
                int separator = id.indexOf('.');
                matches.add("(h.id=:idHero" + index + " and s.skillKey=:idKey" + index + ")");
                parameters.put("idHero" + index, UUID.fromString(id.substring(0, separator)));
                parameters.put("idKey" + index++, id.substring(separator + 1));
            }
            predicate += " and (" + String.join(" or ", matches) + ")";
            newer += " and exists (select ns.skillKey from SkillSnapshotRow ns where "
                    + "ns.skillSetRevisionId=n.skillsRevisionId and ns.skillKey=s.skillKey)";
        }
        predicate += " and not exists (select n.id from HeroRevision n where " + newer + " and (" + order + "))";
        if (heroId != null) {
            predicate += " and h.id=:hero";
            parameters.put("hero", heroId);
        }
        if (search.sourceSlot() != null) {
            int slot = search.sourceSlot();
            if (search.variantNo() != null) {
                predicate += " and s.skillKey=:sourceKey";
                parameters.put("sourceKey", "skill-" + slot + "-" + search.variantNo());
            } else {
                predicate += " and (s.skillKey like :sourcePattern or s.skillKey=:captureKey"
                        + (slot == 0 ? " or s.kind='PASSIVE'" : "") + ")";
                parameters.put("sourcePattern", "skill-" + slot + "-%");
                parameters.put("captureKey", slot == 0 ? "capture-passive" : "capture-skill-" + slot);
            }
        }
        if (!search.words().isEmpty()) {
            parameters.put("diacritics", SkillReferenceSearch.DIACRITICS);
            parameters.put("plain", SkillReferenceSearch.PLAIN);
            for (int index = 0; index < search.words().size(); index++) {
                String parameter = "word" + index;
                predicate += " and (" + normalized("h.code") + " like :" + parameter + " escape '!'"
                        + " or exists (select p.locale from ProfileTranslationRow p where p.profileRevisionId=r.profileRevisionId and "
                        + normalized("p.name") + " like :" + parameter + " escape '!')"
                        + " or exists (select t.locale from SkillTranslationRow t where t.skillSetRevisionId=r.skillsRevisionId"
                        + " and t.skillKey=s.skillKey and " + normalized("t.name") + " like :" + parameter
                        + " escape '!'))";
                String word = search.words().get(index).replace("!", "!!").replace("%", "!%").replace("_", "!_");
                parameters.put(parameter, "%" + word + "%");
            }
        }
        String from = " from HeroIdentity h join HeroRevision r on r.heroId=h.id"
                + " join SkillSnapshotRow s on s.skillSetRevisionId=r.skillsRevisionId where" + predicate;
        var count = entities.createQuery("select count(s.skillKey)" + from, Long.class);
        parameters.forEach(count::setParameter);
        long total = count.getSingleResult();
        if ((long) page * size >= total)
            return new Result(List.of(), total);
        String selection = "select h.id,h.code,r.id,r.profileRevisionId,r.skillsRevisionId,"
                + "(select m.assetId from MediaBindingRow m where m.mediaBindingRevisionId=r.mediaBindingRevisionId"
                + " and m.mediaRole='HEAD'),s.skillKey,s.formKey,s.iconAssetId";
        var query = entities.createQuery(selection + from + " order by h.code,h.id,s.displayOrder,s.skillKey",
                Object[].class);
        parameters.forEach(query::setParameter);
        query.setFirstResult(page * size).setMaxResults(size);
        return new Result(query.getResultList().stream().map(row -> new Row((UUID) row[0], (String) row[1],
                (UUID) row[2], (UUID) row[3], (UUID) row[4], (UUID) row[5], (String) row[6], (String) row[7],
                (UUID) row[8])).toList(), total);
    }
    public List<Copy> skills(List<Row> rows) {
        if (rows.isEmpty())
            return List.of();
        var pairs = new ArrayList<String>();
        var parameters = new LinkedHashMap<String, Object>();
        for (int index = 0; index < rows.size(); index++) {
            pairs.add("(t.skillSetRevisionId=:section" + index + " and t.skillKey=:key" + index + ")");
            parameters.put("section" + index, rows.get(index).skillSetRevisionId());
            parameters.put("key" + index, rows.get(index).skillKey());
        }
        var query = entities.createQuery("select t.skillSetRevisionId,t.skillKey,t.locale,t.name,"
                + "substring(coalesce(t.description,''),1,4000) from SkillTranslationRow t where "
                + String.join(" or ", pairs) + " order by t.skillSetRevisionId,t.skillKey,t.locale", Object[].class);
        parameters.forEach(query::setParameter);
        return query.getResultList().stream().map(row -> new Copy((UUID) row[0], (String) row[1], (String) row[2],
                (String) row[3], (String) row[4])).toList();
    }
    public List<Copy> owners(List<Row> rows) {
        if (rows.isEmpty())
            return List.of();
        return entities.createQuery("select p.profileRevisionId,p.locale,p.name from ProfileTranslationRow p "
                + "where p.profileRevisionId in :ids order by p.profileRevisionId,p.locale", Object[].class)
                .setParameter("ids",
                        rows.stream().map(Row::profileRevisionId).filter(Objects::nonNull).distinct().toList())
                .getResultList().stream()
                .map(row -> new Copy((UUID) row[0], null, (String) row[1], (String) row[2], "")).toList();
    }
    private static String normalized(String field) {
        return "cast(function('translate',lower(" + field + "),:diacritics,:plain) as string)";
    }
    private static String ordinal(String alias, Map<UUID, Long> ordinals) {
        if (ordinals.isEmpty())
            return "0";
        var expression = new StringBuilder("(case ").append(alias).append(".effectiveFromPatchVariantId");
        int index = 0;
        for (var id : new TreeSet<>(ordinals.keySet()))
            expression.append(" when :patch").append(index++).append(" then ").append(ordinals.get(id));
        return expression.append(" else 0 end)").toString();
    }
}
