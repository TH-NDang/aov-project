package com.wikiaov.video.internal.application;

import com.wikiaov.access.*;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.video.VideoSubject;
import com.wikiaov.video.VideoSubjectKind;
import com.wikiaov.video.VideoSubjectProvider;
import com.wikiaov.video.internal.domain.*;
import com.wikiaov.video.internal.persistence.SubjectVideoRepository;
import com.wikiaov.video.internal.persistence.SubjectVideoSpecifications;
import com.wikiaov.video.internal.persistence.entity.SubjectVideo;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Limit;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Videos attached to catalog subjects (ADR-019). Not tied to revisions: changes take effect immediately. */
@Service
@Transactional
public class SubjectVideos {
    private static final int PUBLIC_LIMIT = 200;
    private static final int IMPORT_LIMIT = 500;
    private static final int TITLE_LIMIT = 300;
    private static final int NOTE_LIMIT = 1000;
    private static final int CHANNEL_LIMIT = 120;
    private static final int KEY_LIMIT = 160;
    private static final Set<VideoSubjectKind> HERO_FAMILY = Set.of(VideoSubjectKind.HERO, VideoSubjectKind.SKILL,
            VideoSubjectKind.SKIN);
    private static final Sort LIST_ORDER = Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.asc("id"));
    private static final UUID IMPORT_AUDIT_ID = new UUID(0, 0);

    private final SubjectVideoRepository videos;
    private final Map<VideoSubjectKind, VideoSubjectProvider> providers;
    private final List<VideoSubjectProvider> allProviders;
    private final GameplayContexts contexts;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    public SubjectVideos(SubjectVideoRepository videos, List<VideoSubjectProvider> allProviders,
            GameplayContexts contexts, CurrentActor actors, AuditLog audit, Clock clock) {
        this.videos = videos;
        this.allProviders = List.copyOf(allProviders);
        this.providers = new EnumMap<>(VideoSubjectKind.class);
        for (VideoSubjectProvider provider : allProviders) {
            provider.kinds().forEach(kind -> providers.put(kind, provider));
        }
        this.contexts = contexts;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }

    public record PublicVideo(
            UUID id,
            VideoSubjectKind subjectKind,
            UUID subjectId,
            @Nullable String subjectKey,
            VideoPurpose purpose,
            String title,
            @Nullable String note,
            String url,
            VideoProvider provider,
            @Nullable String providerVideoId,
            int startSeconds,
            @Nullable Integer durationSeconds,
            @Nullable String channelName,
            @Nullable LocalDate publishedOn,
            @Nullable UUID patchVariantId
    ) {
    }

    public record PublicVideoList(
            List<PublicVideo> items
    ) {
    }

    public record AdminVideo(
            UUID id,
            VideoSubjectKind subjectKind,
            UUID subjectId,
            @Nullable String subjectKey,
            VideoPurpose purpose,
            String title,
            @Nullable String note,
            String url,
            VideoProvider provider,
            @Nullable String providerVideoId,
            int startSeconds,
            @Nullable Integer durationSeconds,
            @Nullable String channelName,
            @Nullable LocalDate publishedOn,
            @Nullable UUID patchVariantId,
            int displayOrder,
            VideoStatus status,
            VideoOrigin origin,
            long version,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record AdminFilter(
            @Nullable VideoSubjectKind subjectKind,
            @Nullable UUID subjectId,
            @Nullable String subjectKey,
            @Nullable VideoStatus status,
            @Nullable VideoPurpose purpose,
            @Nullable VideoOrigin origin,
            @Nullable String q
    ) {
    }

    public record SaveVideo(
            VideoSubjectKind subjectKind,
            UUID subjectId,
            @Nullable String subjectKey,
            VideoPurpose purpose,
            String title,
            @Nullable String note,
            String url,
            @Nullable Integer startSeconds,
            @Nullable Integer durationSeconds,
            @Nullable String channelName,
            @Nullable LocalDate publishedOn,
            @Nullable UUID patchVariantId,
            @Nullable Integer displayOrder,
            VideoStatus status,
            @Nullable Long expectedVersion
    ) {
    }

    public record ImportVideo(
            VideoSubjectKind subjectKind,
            UUID subjectId,
            @Nullable String subjectKey,
            VideoPurpose purpose,
            String title,
            String url,
            @Nullable Integer durationSeconds,
            @Nullable LocalDate publishedOn,
            @Nullable Integer displayOrder,
            VideoStatus status
    ) {
    }

    public record ImportVideos(
            List<ImportVideo> items
    ) {
    }

    public record ImportRejection(
            int index,
            String reason
    ) {
    }

    public record ImportResult(
            int created,
            int skipped,
            List<ImportRejection> rejected
    ) {
    }

    public record SubjectList(
            List<VideoSubject> items
    ) {
    }

    /**
     * A hero's page shows its own videos and those of its skills and skins, so the hero kind covers all three. The skill
     * and skin kinds narrow to one subject when a key is given.
     */
    @Transactional(readOnly = true)
    public PublicVideoList published(VideoSubjectKind kind, UUID subjectId, @Nullable String subjectKey) {
        if (kind == null || subjectId == null)
            throw invalid("Provide the subject kind and id.");
        if (subjectKey != null && !kind.requiresKey())
            throw invalid("Only skills and skins take a subject key.");

        List<SubjectVideo> rows = subjectKey == null
                ? videos.findBySubjectIdAndStatusAndSubjectKindInOrderByDisplayOrderAscPublishedOnDescIdAsc(subjectId,
                        VideoStatus.PUBLISHED, kind == VideoSubjectKind.HERO ? HERO_FAMILY : Set.of(kind),
                        Limit.of(PUBLIC_LIMIT))
                : videos.findBySubjectIdAndStatusAndSubjectKindAndSubjectKeyOrderByDisplayOrderAscPublishedOnDescIdAsc(
                        subjectId, VideoStatus.PUBLISHED, kind, subjectKey, Limit.of(PUBLIC_LIMIT));

        return new PublicVideoList(rows.stream().map(SubjectVideos::publicView).toList());
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<AdminVideo> list(AdminFilter filter, int page, int size) {
        // Filtering one hero means everything on its page, as in the public read.
        Set<VideoSubjectKind> kinds = filter.subjectKind() == null
                ? Set.of()
                : filter.subjectKind() == VideoSubjectKind.HERO && filter.subjectId() != null
                        ? HERO_FAMILY
                        : Set.of(filter.subjectKind());
        var specification = SubjectVideoSpecifications.matching(kinds, filter.subjectId(), filter.subjectKey(),
                filter.status(), filter.purpose(), filter.origin(), filter.q());
        Sort order = filter.subjectId() == null
                ? LIST_ORDER
                : Sort.by(Sort.Order.asc("subjectKind"), Sort.Order.asc("subjectKey"), Sort.Order.asc("displayOrder"),
                        Sort.Order.asc("id"));
        var result = videos.findAll(specification, PageRequest.of(page, size, order));

        return new PageSlice<>(result.getContent().stream().map(SubjectVideos::adminView).toList(), page, size,
                result.getTotalElements());
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public SubjectList subjects(String locale) {
        return new SubjectList(allProviders.stream().flatMap(provider -> provider.subjects(locale).stream()).toList());
    }

    public AdminVideo create(SaveVideo input) {
        Actor actor = actors.require();
        requireInput(input);
        requireCapabilities(actor, input.subjectKind(), input.status());
        requireSubject(input.subjectKind(), input.subjectId(), input.subjectKey());
        VideoLink link = link(input.url());
        int start = start(input.startSeconds(), link);
        requirePatch(input.patchVariantId());

        if (videos.existsBySubjectKindAndSubjectIdAndSubjectKeyAndUrlAndStartSeconds(input.subjectKind(),
                input.subjectId(), input.subjectKey(), link.url(), start))
            throw duplicate();

        var video = new SubjectVideo();
        video.setId(UUID.randomUUID());
        video.setOrigin(VideoOrigin.MANUAL);
        video.setVersion(1);
        video.setCreatedAt(clock.instant());
        apply(video, input, link, start);
        video.setDisplayOrder(input.displayOrder() != null
                ? input.displayOrder()
                : nextOrder(input.subjectKind(), input.subjectId(), input.subjectKey()));
        videos.saveAndFlush(video);

        audit.record(new AuditEntry(actor, "VIDEO_CREATED", "VIDEO", video.getId(), null, null, video.getVersion(),
                null, auditMetadata(video)));

        return adminView(video);
    }

    public AdminVideo update(UUID id, SaveVideo input) {
        Actor actor = actors.require();
        requireInput(input);
        if (input.expectedVersion() == null)
            throw invalid("Provide the version you are changing.");

        SubjectVideo video = videos.findById(id).orElseThrow(SubjectVideos::notFound);
        requireCapabilities(actor, video.getSubjectKind(), video.getStatus());
        requireCapabilities(actor, input.subjectKind(), input.status());
        if (video.getVersion() != input.expectedVersion())
            throw new ApiException(VideoErrorCode.VIDEO_CONFLICT, "The video has changed. Reload before saving.");
        requireSubject(input.subjectKind(), input.subjectId(), input.subjectKey());
        VideoLink link = link(input.url());
        int start = start(input.startSeconds(), link);
        requirePatch(input.patchVariantId());

        boolean sameTarget = video.getSubjectKind() == input.subjectKind()
                && video.getSubjectId().equals(input.subjectId())
                && Objects.equals(video.getSubjectKey(), input.subjectKey()) && video.getUrl().equals(link.url())
                && video.getStartSeconds() == start;
        if (!sameTarget && videos.existsBySubjectKindAndSubjectIdAndSubjectKeyAndUrlAndStartSeconds(input.subjectKind(),
                input.subjectId(), input.subjectKey(), link.url(), start))
            throw duplicate();

        long before = video.getVersion();
        apply(video, input, link, start);
        if (input.displayOrder() != null)
            video.setDisplayOrder(input.displayOrder());
        video.setVersion(before + 1);
        videos.saveAndFlush(video);

        audit.record(new AuditEntry(actor, "VIDEO_UPDATED", "VIDEO", video.getId(), null, before, video.getVersion(),
                null, auditMetadata(video)));

        return adminView(video);
    }

    public void delete(UUID id, long expectedVersion) {
        Actor actor = actors.require();
        SubjectVideo video = videos.findById(id).orElseThrow(SubjectVideos::notFound);
        requireCapabilities(actor, video.getSubjectKind(), video.getStatus());
        if (video.getVersion() != expectedVersion)
            throw new ApiException(VideoErrorCode.VIDEO_CONFLICT, "The video has changed. Reload before deleting.");

        videos.delete(video);

        audit.record(new AuditEntry(actor, "VIDEO_DELETED", "VIDEO", id, null, expectedVersion, null, null,
                auditMetadata(video)));
    }

    /**
     * Adds rows that are not there yet and leaves existing ones alone, so editors' changes and rejections survive a
     * repeated import. A bad row is reported without failing the rest of the batch.
     */
    public ImportResult importVideos(ImportVideos input) {
        Actor actor = actors.require();
        if (input == null || input.items() == null || input.items().isEmpty() || input.items().size() > IMPORT_LIMIT)
            throw invalid("Provide between 1 and " + IMPORT_LIMIT + " videos.");
        if (input.items().stream().anyMatch(Objects::isNull))
            throw invalid("Every imported row must be present.");
        for (ImportVideo row : input.items()) {
            if (row.subjectKind() == null || row.status() == null)
                throw invalid("Every imported row needs a subject kind and a status.");
            requireCapabilities(actor, row.subjectKind(), row.status());
        }

        Set<UUID> subjectIds = input.items().stream().map(ImportVideo::subjectId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        List<SubjectVideo> existing = videos.findBySubjectIdIn(subjectIds);
        Set<String> seen = existing.stream()
                .map(v -> identity(v.getSubjectKind(), v.getSubjectId(), v.getSubjectKey(), v.getUrl(),
                        v.getStartSeconds()))
                .collect(Collectors.toCollection(HashSet::new));
        Map<String, Integer> nextOrder = new HashMap<>();
        for (SubjectVideo video : existing) {
            nextOrder.merge(subjectIdentity(video.getSubjectKind(), video.getSubjectId(), video.getSubjectKey()),
                    video.getDisplayOrder() + 1, Math::max);
        }
        Map<String, Boolean> subjects = new HashMap<>();

        int created = 0;
        int skipped = 0;
        var rejected = new ArrayList<ImportRejection>();
        Instant now = clock.instant();
        for (int index = 0; index < input.items().size(); index++) {
            ImportVideo row = input.items().get(index);
            String problem = importProblem(row, subjects);
            VideoLink link = problem == null ? VideoLink.parse(row.url()).orElse(null) : null;
            if (problem == null && link == null)
                problem = "The link is not an http or https address.";
            if (problem != null) {
                rejected.add(new ImportRejection(index, problem));
                continue;
            }
            if (!seen.add(identity(row.subjectKind(), row.subjectId(), row.subjectKey(), link.url(),
                    link.startSeconds()))) {
                skipped++;
                continue;
            }

            String order = subjectIdentity(row.subjectKind(), row.subjectId(), row.subjectKey());
            int displayOrder = row.displayOrder() != null ? row.displayOrder() : nextOrder.getOrDefault(order, 0);
            nextOrder.merge(order, displayOrder + 1, Math::max);
            videos.save(imported(row, link, displayOrder, now));
            created++;
        }
        videos.flush();

        if (created > 0)
            audit.record(new AuditEntry(actor, "VIDEOS_IMPORTED", "VIDEO", IMPORT_AUDIT_ID, null, null, null, null,
                    Map.of("created", created, "skipped", skipped, "rejected", rejected.size())));

        return new ImportResult(created, skipped, rejected);
    }

    private String importProblem(ImportVideo row, Map<String, Boolean> subjects) {
        if (row.subjectId() == null || row.purpose() == null)
            return "The subject id and purpose are required.";
        if (row.title() == null || row.title().isBlank() || row.title().strip().length() > TITLE_LIMIT)
            return "The title is required and limited to " + TITLE_LIMIT + " characters.";
        if (row.durationSeconds() != null && row.durationSeconds() <= 0)
            return "The duration must be positive.";
        if (row.subjectKind().requiresKey() != (row.subjectKey() != null && !row.subjectKey().isBlank()))
            return "Only skills and skins take a subject key.";

        boolean exists = subjects.computeIfAbsent(subjectIdentity(row.subjectKind(), row.subjectId(), row.subjectKey()),
                ignored -> subjectExists(row.subjectKind(), row.subjectId(), row.subjectKey()));
        return exists ? null : "The subject does not exist.";
    }

    private SubjectVideo imported(ImportVideo row, VideoLink link, int displayOrder, Instant now) {
        var video = new SubjectVideo();
        video.setId(UUID.randomUUID());
        video.setSubjectKind(row.subjectKind());
        video.setSubjectId(row.subjectId());
        video.setSubjectKey(row.subjectKey());
        video.setPurpose(row.purpose());
        video.setTitle(row.title().strip());
        video.setUrl(link.url());
        video.setProvider(link.provider());
        video.setProviderVideoId(link.providerVideoId());
        video.setStartSeconds(link.startSeconds());
        video.setDurationSeconds(row.durationSeconds());
        video.setPublishedOn(row.publishedOn());
        video.setDisplayOrder(displayOrder);
        video.setStatus(row.status());
        video.setOrigin(VideoOrigin.IMPORT);
        video.setVersion(1);
        video.setCreatedAt(now);
        video.setUpdatedAt(now);
        return video;
    }

    private void apply(SubjectVideo video, SaveVideo input, VideoLink link, int start) {
        video.setSubjectKind(input.subjectKind());
        video.setSubjectId(input.subjectId());
        video.setSubjectKey(input.subjectKey());
        video.setPurpose(input.purpose());
        video.setTitle(input.title().strip());
        video.setNote(blankToNull(input.note()));
        video.setUrl(link.url());
        video.setProvider(link.provider());
        video.setProviderVideoId(link.providerVideoId());
        video.setStartSeconds(start);
        video.setDurationSeconds(input.durationSeconds());
        video.setChannelName(blankToNull(input.channelName()));
        video.setPublishedOn(input.publishedOn());
        video.setPatchVariantId(input.patchVariantId());
        video.setStatus(input.status());
        video.setUpdatedAt(clock.instant());
    }

    private static void requireInput(SaveVideo input) {
        if (input == null || input.subjectKind() == null || input.subjectId() == null || input.purpose() == null
                || input.status() == null)
            throw invalid("Provide the subject, purpose and status.");
        if (input.subjectKind().requiresKey() != (input.subjectKey() != null && !input.subjectKey().isBlank()))
            throw invalid("Skills and skins need a subject key; other subjects do not take one.");
        if (input.subjectKey() != null && input.subjectKey().length() > KEY_LIMIT)
            throw invalid("The subject key is limited to " + KEY_LIMIT + " characters.");
        if (input.title() == null || input.title().isBlank() || input.title().strip().length() > TITLE_LIMIT)
            throw invalid("The title is required and limited to " + TITLE_LIMIT + " characters.");
        if (input.note() != null && input.note().strip().length() > NOTE_LIMIT)
            throw invalid("The note is limited to " + NOTE_LIMIT + " characters.");
        if (input.channelName() != null && input.channelName().strip().length() > CHANNEL_LIMIT)
            throw invalid("The channel name is limited to " + CHANNEL_LIMIT + " characters.");
        if (input.startSeconds() != null && input.startSeconds() < 0)
            throw invalid("The start point cannot be negative.");
        if (input.durationSeconds() != null && input.durationSeconds() <= 0)
            throw invalid("The duration must be positive.");
    }

    private static void requireCapabilities(Actor actor, VideoSubjectKind kind, VideoStatus status) {
        String write = switch (kind) {
            case HERO, SKILL, SKIN -> Capabilities.HERO_WRITE;
            case ITEM -> Capabilities.ITEM_WRITE;
            case ENCHANTMENT -> Capabilities.ENCHANTMENT_WRITE;
            case ARCANA -> Capabilities.ARCANA_WRITE;
            case SPELL -> Capabilities.SPELL_WRITE;
        };
        if (!actor.has(write))
            throw new AccessDeniedException("Editing these videos requires " + write + ".");

        String publish = write.replace(":write", ":publish");
        if (status == VideoStatus.PUBLISHED && !actor.has(publish))
            throw new AccessDeniedException("Publishing these videos requires " + publish + ".");
    }

    private void requireSubject(VideoSubjectKind kind, UUID id, @Nullable String key) {
        if (!subjectExists(kind, id, key))
            throw new ApiException(VideoErrorCode.VIDEO_SUBJECT_NOT_FOUND, "The video's subject does not exist.");
    }

    private boolean subjectExists(VideoSubjectKind kind, UUID id, @Nullable String key) {
        VideoSubjectProvider provider = providers.get(kind);
        return provider != null && provider.exists(kind, id, key);
    }

    private void requirePatch(@Nullable UUID variantId) {
        if (variantId != null)
            contexts.variant(variantId);
    }

    private static VideoLink link(String url) {
        return VideoLink.parse(url).orElseThrow(() -> invalid("The link must be an http or https address."));
    }

    private static int start(@Nullable Integer explicit, VideoLink link) {
        return explicit != null ? explicit : link.startSeconds();
    }

    private int nextOrder(VideoSubjectKind kind, UUID id, @Nullable String key) {
        return videos.findFirstBySubjectKindAndSubjectIdAndSubjectKeyOrderByDisplayOrderDesc(kind, id, key)
                .map(video -> video.getDisplayOrder() + 1).orElse(0);
    }

    private static String subjectIdentity(VideoSubjectKind kind, UUID id, @Nullable String key) {
        return kind + "|" + id + "|" + key;
    }

    private static String identity(VideoSubjectKind kind, UUID id, @Nullable String key, String url, int start) {
        return subjectIdentity(kind, id, key) + "|" + url + "|" + start;
    }

    private static Map<String, Object> auditMetadata(SubjectVideo video) {
        var metadata = new HashMap<String, Object>();
        metadata.put("subjectKind", video.getSubjectKind().name());
        metadata.put("subjectId", video.getSubjectId().toString());
        if (video.getSubjectKey() != null)
            metadata.put("subjectKey", video.getSubjectKey());
        metadata.put("url", video.getUrl());
        metadata.put("status", video.getStatus().name());
        return metadata;
    }

    private static PublicVideo publicView(SubjectVideo video) {
        return new PublicVideo(video.getId(), video.getSubjectKind(), video.getSubjectId(), video.getSubjectKey(),
                video.getPurpose(), video.getTitle(), video.getNote(), video.getUrl(), video.getProvider(),
                video.getProviderVideoId(), video.getStartSeconds(), video.getDurationSeconds(),
                video.getChannelName(), video.getPublishedOn(), video.getPatchVariantId());
    }

    private static AdminVideo adminView(SubjectVideo video) {
        return new AdminVideo(video.getId(), video.getSubjectKind(), video.getSubjectId(), video.getSubjectKey(),
                video.getPurpose(), video.getTitle(), video.getNote(), video.getUrl(), video.getProvider(),
                video.getProviderVideoId(), video.getStartSeconds(), video.getDurationSeconds(),
                video.getChannelName(), video.getPublishedOn(), video.getPatchVariantId(), video.getDisplayOrder(),
                video.getStatus(), video.getOrigin(), video.getVersion(), video.getCreatedAt(), video.getUpdatedAt());
    }

    private static @Nullable String blankToNull(@Nullable String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private static ApiException invalid(String detail) {
        return new ApiException(VideoErrorCode.VIDEO_INVALID, detail);
    }

    private static ApiException duplicate() {
        return new ApiException(VideoErrorCode.VIDEO_DUPLICATE, "This video is already attached to the subject.");
    }

    private static ApiException notFound() {
        return new ApiException(VideoErrorCode.VIDEO_NOT_FOUND, "The video was not found.");
    }
}
