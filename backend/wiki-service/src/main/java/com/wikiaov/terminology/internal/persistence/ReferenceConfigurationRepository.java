package com.wikiaov.terminology.internal.persistence;
import com.wikiaov.terminology.internal.persistence.entity.ReferenceConfiguration;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface ReferenceConfigurationRepository extends JpaRepository<ReferenceConfiguration, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from ReferenceConfiguration e where e.id=:id")
    Optional<ReferenceConfiguration> lockById(UUID id);
}
