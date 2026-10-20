package com.wikiaov.hero.internal.persistence;
import com.wikiaov.hero.internal.persistence.entity.HeroPatchAssessment;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface HeroPatchAssessmentRepository extends JpaRepository<HeroPatchAssessment, UUID> {
}
