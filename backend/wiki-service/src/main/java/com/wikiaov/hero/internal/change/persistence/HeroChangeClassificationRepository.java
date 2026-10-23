package com.wikiaov.hero.internal.change.persistence;

import com.wikiaov.hero.internal.change.persistence.entity.HeroChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.MechanicChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.OtherChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.RoleChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.SkillChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.StatChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.VisualChangeClassification;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/** Keeps each append-only table's field types separate and batches detailed history by table. */
@Repository
public class HeroChangeClassificationRepository {
    private final StatChangeRepository stats;
    private final SkillChangeRepository skills;
    private final RoleChangeRepository roles;
    private final VisualChangeRepository visuals;
    private final MechanicChangeRepository mechanics;
    private final OtherChangeRepository others;
    private final HeroChangeKindProjectionRepository kinds;

    public HeroChangeClassificationRepository(StatChangeRepository stats, SkillChangeRepository skills,
            RoleChangeRepository roles, VisualChangeRepository visuals, MechanicChangeRepository mechanics,
            OtherChangeRepository others, HeroChangeKindProjectionRepository kinds) {
        this.stats = stats;
        this.skills = skills;
        this.roles = roles;
        this.visuals = visuals;
        this.mechanics = mechanics;
        this.others = others;
        this.kinds = kinds;
    }

    public void save(HeroChangeClassification value) {
        switch (value) {
            case StatChangeClassification stat -> stats.save(stat);
            case SkillChangeClassification skill -> skills.save(skill);
            case RoleChangeClassification role -> roles.save(role);
            case VisualChangeClassification visual -> visuals.save(visual);
            case MechanicChangeClassification mechanic -> mechanics.save(mechanic);
            case OtherChangeClassification other -> others.save(other);
            default -> throw new IllegalArgumentException("Unsupported hero change classification.");
        }
    }

    public List<Kind> kinds(Collection<UUID> ids) {
        if (ids.isEmpty())
            return List.of();

        return kinds.kinds(ids);
    }

    public List<HeroChangeClassification> findByChangeSetIdIn(Collection<UUID> ids) {
        if (ids.isEmpty())
            return List.of();

        var facts = new ArrayList<HeroChangeClassification>();
        facts.addAll(stats.findByChangeSetIdInOrderBySortOrderAscIdAsc(ids));
        facts.addAll(skills.findByChangeSetIdInOrderBySortOrderAscIdAsc(ids));
        facts.addAll(roles.findByChangeSetIdInOrderBySortOrderAscIdAsc(ids));
        facts.addAll(visuals.findByChangeSetIdInOrderBySortOrderAscIdAsc(ids));
        facts.addAll(mechanics.findByChangeSetIdInOrderBySortOrderAscIdAsc(ids));
        facts.addAll(others.findByChangeSetIdInOrderBySortOrderAscIdAsc(ids));

        facts.sort(Comparator.comparingInt(HeroChangeClassification::getSortOrder)
                .thenComparingInt(HeroChangeClassificationRepository::tableOrder)
                .thenComparing(HeroChangeClassification::getId));
        return List.copyOf(facts);
    }

    private static int tableOrder(HeroChangeClassification value) {
        return switch (value) {
            case StatChangeClassification ignored -> 0;
            case SkillChangeClassification ignored -> 1;
            case RoleChangeClassification ignored -> 2;
            case VisualChangeClassification ignored -> 3;
            case MechanicChangeClassification ignored -> 4;
            case OtherChangeClassification ignored -> 5;
            default -> throw new IllegalArgumentException("Unsupported hero change classification.");
        };
    }

    public interface Kind {
        UUID getChangeSetId();

        String getChangeKind();
    }
}
