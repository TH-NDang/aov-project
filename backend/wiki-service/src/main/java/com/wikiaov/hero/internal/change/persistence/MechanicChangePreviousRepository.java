package com.wikiaov.hero.internal.change.persistence;

import com.wikiaov.hero.internal.change.persistence.entity.MechanicChangePrevious;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Appends and batches the descriptions of what mechanics did before they changed. */
public interface MechanicChangePreviousRepository extends JpaRepository<MechanicChangePrevious, UUID> {
}
