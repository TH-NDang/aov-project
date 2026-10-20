package com.wikiaov.terminology.internal.persistence;
import com.wikiaov.terminology.internal.persistence.entity.ReferenceTranslation;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ReferenceTranslationRepository extends JpaRepository<ReferenceTranslation, UUID> {
}
