package com.wikiaov.hero.internal.profile.persistence;

import com.wikiaov.hero.internal.profile.persistence.entity.ProfilePositionRow;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProfilePositionRepository extends JpaRepository<ProfilePositionRow, ProfilePositionRow.Key> {
    List<ProfilePositionRow> findByProfileRevisionIdIn(Collection<UUID> ids, Sort sort);
}
