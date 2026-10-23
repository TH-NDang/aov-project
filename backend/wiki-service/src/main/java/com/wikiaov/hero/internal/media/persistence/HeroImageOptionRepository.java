package com.wikiaov.hero.internal.media.persistence;

import com.wikiaov.hero.internal.media.persistence.entity.HeroImageOption;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HeroImageOptionRepository extends JpaRepository<HeroImageOption, HeroImageOption.Key> {
    List<HeroImageOption> findByMediaBindingRevisionIdIn(Collection<UUID> ids, Sort sort);
}
