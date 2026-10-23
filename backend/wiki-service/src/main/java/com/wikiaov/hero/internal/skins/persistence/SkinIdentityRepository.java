package com.wikiaov.hero.internal.skins.persistence;

import com.wikiaov.hero.internal.skins.persistence.entity.SkinIdentityRow;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkinIdentityRepository extends JpaRepository<SkinIdentityRow, SkinIdentityRow.Key> {
}
