package com.wikiaov.hero.internal.stats.persistence.entity;

import com.wikiaov.hero.internal.sections.persistence.entity.SectionRevision;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "hero", name = "hero_combat_stats_revision")
public class StatsRevision extends SectionRevision {
}
