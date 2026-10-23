package com.wikiaov.hero.internal.profile.persistence;

import com.wikiaov.hero.internal.profile.persistence.entity.ProfileRoleRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProfileRoleRepository extends JpaRepository<ProfileRoleRow, ProfileRoleRow.Key> {
    List<ProfileRoleRow> findByProfileRevisionIdIn(Collection<UUID> ids, Sort sort);
}
