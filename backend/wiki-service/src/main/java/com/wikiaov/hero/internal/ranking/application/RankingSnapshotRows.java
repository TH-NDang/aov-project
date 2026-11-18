package com.wikiaov.hero.internal.ranking.application;

import static com.wikiaov.hero.internal.ranking.application.RankingSnapshotRules.blankToNull;

import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.application.HeroRankingCommands;
import com.wikiaov.hero.internal.application.HeroRankingCommands.ImportSnapshot;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotHeroRow;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotImageRow;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotRow;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotValueRow;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** The rows an imported ranking snapshot is stored as (ADR-025), built from a request the rules accepted. */
final class RankingSnapshotRows {
    private RankingSnapshotRows() {
    }

    static RankingSnapshotRow snapshotRow(ImportSnapshot request, Actor actor, Instant now) {
        var snapshot = new RankingSnapshotRow();
        snapshot.setId(UUID.randomUUID());
        snapshot.setCode(request.code());
        snapshot.setRegionCode(request.regionCode());
        snapshot.setModeCode(request.modeCode());
        snapshot.setModeLabel(request.modeLabel().trim());
        snapshot.setPeriodLabel(blankToNull(request.periodLabel()));
        snapshot.setCapturedAt(request.capturedAt());
        snapshot.setSourceTimeZone(request.sourceTimeZone());
        snapshot.setSourceRun(request.sourceRun().trim());
        snapshot.setSourceNote(blankToNull(request.sourceNote()));
        snapshot.setVersion(1);
        snapshot.setCreatedAt(now);
        snapshot.setCreatedByIssuer(actor.issuer());
        snapshot.setCreatedBySubject(actor.subject());
        snapshot.setUpdatedAt(now);
        return snapshot;
    }

    static RankingSnapshotImageRow imageRow(UUID snapshotId, HeroRankingCommands.Image image) {
        var row = new RankingSnapshotImageRow();
        row.setSnapshotId(snapshotId);
        row.setImageId(image.imageId());
        row.setBoard(image.board());
        row.setPageNo(image.pageNo());
        row.setFileName(image.fileName().trim());
        row.setWidth(image.width());
        row.setHeight(image.height());
        return row;
    }

    static RankingSnapshotHeroRow entryRow(UUID snapshotId, UUID heroId, HeroRankingCommands.Hero hero) {
        var row = new RankingSnapshotHeroRow();
        row.setSnapshotId(snapshotId);
        row.setHeroId(heroId);
        row.setNameOnScreen(hero.nameOnScreen().trim());
        row.setRoleOnScreen(hero.roleOnScreen());
        row.setRatesPosition(hero.ratesPosition());
        row.setFiguresPosition(hero.figuresPosition());
        return row;
    }

    static RankingSnapshotValueRow valueRow(UUID snapshotId, UUID heroId, HeroRankingCommands.Value value,
            Map<String, UUID> heroIds, Instant now) {
        var row = new RankingSnapshotValueRow();
        row.setSnapshotId(snapshotId);
        row.setHeroId(heroId);
        row.setMetric(value.metric());
        row.setNumberValue(value.number());
        row.setTierValue(blankToNull(value.tier()));
        String counter = blankToNull(value.heroCode());
        row.setHeroValue(counter == null ? null : heroIds.get(counter));
        row.setReadText(blankToNull(value.readText()));
        row.setNeedsReview(value.needsReview());
        row.setNote(blankToNull(value.note()));
        if (value.source() != null) {
            row.setImageId(value.source().imageId());
            row.setBoxX(value.source().x());
            row.setBoxY(value.source().y());
            row.setBoxWidth(value.source().width());
            row.setBoxHeight(value.source().height());
        }
        row.setVersion(1);
        row.setUpdatedAt(now);
        return row;
    }
}
