package com.wikiaov.hero.internal.skins.persistence;

import com.wikiaov.hero.internal.skins.persistence.entity.SkinImageOption;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkinImageOptionRepository extends JpaRepository<SkinImageOption, SkinImageOption.Key> {
    List<SkinImageOption> findBySkinSetRevisionIdIn(Collection<UUID> ids, Sort sort);
}
