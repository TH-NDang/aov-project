package com.wikiaov.patch.internal.persistence;

import com.wikiaov.patch.internal.persistence.entity.SeasonSchedule;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeasonScheduleRepository extends JpaRepository<SeasonSchedule, UUID> {
    Optional<SeasonSchedule> findBySeasonIdAndRegionId(UUID seasonId, UUID regionId);
}
