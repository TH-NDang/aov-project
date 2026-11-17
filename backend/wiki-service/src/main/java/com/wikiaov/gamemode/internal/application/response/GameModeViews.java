package com.wikiaov.gamemode.internal.application.response;

import com.wikiaov.gamemode.internal.domain.AutoChessContent;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.LineupUnit;
import com.wikiaov.gamemode.internal.domain.GameModeContent;
import com.wikiaov.gamemode.internal.domain.RevisionRecord;
import com.wikiaov.gamemode.internal.lineup.domain.LineupInsights;
import com.wikiaov.gamemode.internal.lineup.domain.LineupStatus;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaCredit;
import com.wikiaov.platform.RevisionState;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** HTTP response shapes of the game mode module. Text content is Vietnamese ({@code contentLocale = vi-VN}). */
public final class GameModeViews {
    public static final String CONTENT_LOCALE = "vi-VN";

    private GameModeViews() {
    }

    /** A usable image with its public credit. */
    public record Image(
            UUID assetId,
            UUID versionId,
            String url,
            int width,
            int height,
            List<MediaCredit> credits,
            MediaAssetReference.FocalPoint focalPoint
    ) {
    }

    public record Revision(
            UUID id,
            long revisionNo,
            RevisionState state,
            long version,
            UUID sourceRevisionId,
            String changeNote,
            Instant publishedAt,
            Instant createdAt,
            Instant updatedAt
    ) {

        public static Revision of(RevisionRecord record) {
            return record == null
                    ? null
                    : new Revision(record.getId(), record.getRevisionNo(), record.getState(), record.getVersion(),
                            record.getSourceRevisionId(), record.getChangeNote(), record.getPublishedAt(),
                            record.getCreatedAt(), record.getUpdatedAt());
        }
    }

    public record GuideState(
            Revision published,
            Revision draft
    ) {
    }

    public record AdminSummary(
            UUID id,
            String code,
            String name,
            String group,
            Integer order,
            String guideKind,
            Image art,
            Revision published,
            Revision draft,
            GuideState guide
    ) {
    }

    public record AdminMode(
            UUID id,
            String code,
            Revision revision,
            boolean hasPublished,
            GameModeContent content,
            List<String> missingFields,
            Map<UUID, Image> images
    ) {
    }

    public record Card(
            String code,
            String name,
            String group,
            Integer order,
            String summary,
            String playersLabel,
            GameModeContent.Duration duration,
            GameModeContent.Availability availability,
            String guideKind,
            boolean hasGuide,
            Image art,
            Instant publishedAt
    ) {
    }

    public record CardList(
            List<Card> items
    ) {
    }

    public record PublicMode(
            String code,
            String contentLocale,
            Instant publishedAt,
            boolean hasGuide,
            GameModeContent content,
            Map<UUID, Image> images
    ) {
    }

    public record AdminGuide(
            UUID modeId,
            String modeCode,
            Revision revision,
            boolean hasPublished,
            AutoChessContent content,
            List<String> missingFields,
            Map<UUID, Image> images
    ) {
    }

    public record LikeCount(
            long likes,
            long recentLikes
    ) {
    }

    public record PublicGuide(
            String modeCode,
            String modeName,
            String contentLocale,
            UUID revisionId,
            Instant publishedAt,
            AutoChessContent content,
            Map<UUID, Image> images,
            Map<UUID, LikeCount> lineupLikes
    ) {
    }

    public record PublicLineup(
            UUID id,
            String name,
            String note,
            List<LineupUnit> units,
            List<String> emblems,
            long likes,
            long recentLikes,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record OwnLineup(
            UUID id,
            String name,
            String note,
            List<LineupUnit> units,
            List<String> emblems,
            LineupStatus status,
            long version,
            long likes,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record AdminLineup(
            UUID id,
            String name,
            String note,
            List<LineupUnit> units,
            List<String> emblems,
            LineupStatus status,
            String hiddenReason,
            String authorSubject,
            long version,
            long likes,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record MyState(
            List<UUID> likedLineupIds,
            List<OwnLineup> lineups
    ) {
    }

    public record LikeState(
            UUID lineupId,
            boolean liked,
            long likes
    ) {
    }

    public record Insights(
            int lineupCount,
            int communityLineupCount,
            List<LineupInsights.UnitUsage> units,
            List<LineupInsights.TraitUsage> traits,
            List<LineupInsights.CostShare> costs
    ) {
    }
}
