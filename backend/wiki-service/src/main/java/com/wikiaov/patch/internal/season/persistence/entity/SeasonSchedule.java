package com.wikiaov.patch.internal.season.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "patch", name = "season_schedule")
public class SeasonSchedule {
    @Id
    private UUID id;
    private UUID seasonId;
    private UUID regionId;
    private Instant startsAt;
    private Instant endsAt;
    private java.time.LocalDate startsOn;
    private java.time.LocalDate endsOn;
}
