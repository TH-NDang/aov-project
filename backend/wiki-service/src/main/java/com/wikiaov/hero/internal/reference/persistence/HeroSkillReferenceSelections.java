package com.wikiaov.hero.internal.reference.persistence;

import com.wikiaov.hero.internal.reference.persistence.HeroSkillReferenceRepository.Copy;
import com.wikiaov.hero.internal.reference.persistence.HeroSkillReferenceRepository.Result;
import com.wikiaov.hero.internal.reference.persistence.HeroSkillReferenceRepository.Row;
import java.util.List;

public interface HeroSkillReferenceSelections {
    Result selectSkills(SkillReferenceCriteria criteria);

    List<Copy> selectSkillCopies(List<Row> rows);
}
