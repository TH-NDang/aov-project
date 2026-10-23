package com.wikiaov.hero.internal.change.persistence;

import com.wikiaov.hero.internal.change.persistence.HeroChangeClassificationRepository.Kind;
import com.wikiaov.hero.internal.change.persistence.entity.StatChangeClassification;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Combines only compatible UUID/string fields, never the heterogeneous numeric/text values. */
public interface HeroChangeKindProjectionRepository extends Repository<StatChangeClassification, UUID> {
    @Query("""
            select c.changeSetId as changeSetId, c.changeKind as changeKind
            from StatChangeClassification c where c.changeSetId in :ids
            union
            select c.changeSetId as changeSetId, c.changeKind as changeKind
            from SkillChangeClassification c where c.changeSetId in :ids
            union
            select c.changeSetId as changeSetId, c.changeKind as changeKind
            from RoleChangeClassification c where c.changeSetId in :ids
            union
            select c.changeSetId as changeSetId, c.changeKind as changeKind
            from VisualChangeClassification c where c.changeSetId in :ids
            union
            select c.changeSetId as changeSetId, c.changeKind as changeKind
            from MechanicChangeClassification c where c.changeSetId in :ids
            union
            select c.changeSetId as changeSetId, c.changeKind as changeKind
            from OtherChangeClassification c where c.changeSetId in :ids
            """)
    List<Kind> kinds(@Param("ids") Collection<UUID> ids);
}
