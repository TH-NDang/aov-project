package com.wikiaov.hero.internal.persistence;

import com.wikiaov.hero.internal.persistence.entity.SkillIdentityRow;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkillIdentityRepository extends JpaRepository<SkillIdentityRow, SkillIdentityRow.Key> {
    boolean existsByHeroIdAndSkillKey(UUID heroId, String skillKey);
}
