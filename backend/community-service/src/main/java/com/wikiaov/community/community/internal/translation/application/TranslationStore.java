package com.wikiaov.community.community.internal.translation.application;

import com.wikiaov.community.community.internal.domain.PostStatus;
import com.wikiaov.community.community.internal.pages.application.PageAccess;
import com.wikiaov.community.community.internal.social.persistence.CommunityPostRepository;
import com.wikiaov.community.community.internal.translation.domain.TranslatedPost;
import com.wikiaov.community.community.internal.translation.persistence.PostTranslationRecord;
import com.wikiaov.community.community.internal.translation.persistence.PostTranslationRepository;
import com.wikiaov.community.community.internal.translation.persistence.TranslationUsageRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** The short transactions around a translation; the call to the model runs outside all of them. */
@Component
class TranslationStore {
    private final CommunityPostRepository posts;
    private final PageAccess access;
    private final PostTranslationRepository translations;
    private final TranslationUsageRepository usage;
    private final Clock clock = Clock.systemUTC();

    TranslationStore(CommunityPostRepository posts, PageAccess access, PostTranslationRepository translations,
            TranslationUsageRepository usage) {
        this.posts = posts;
        this.access = access;
        this.translations = translations;
        this.usage = usage;
    }

    record Post(
            UUID id,
            @Nullable String title,
            String body,
            List<String> imageUrls
    ) {
    }

    record Stored(
            String sourceHash,
            TranslatedPost post,
            String model
    ) {
    }

    /** A published post on a page the public can read; the same rule as its comments. */
    @Transactional(readOnly = true)
    public Post published(UUID id) {
        var post = posts.findById(id).orElseThrow(PageAccess::missing);
        access.social(post.getPageId());
        if (post.getStatus() != PostStatus.PUBLISHED) {
            throw PageAccess.missing();
        }
        return new Post(post.getId(), post.getTitle(), post.getBody() == null ? "" : post.getBody(),
                List.copyOf(post.getImageUrls()));
    }

    @Transactional(readOnly = true)
    public Optional<Stored> stored(UUID postId, String locale) {
        return translations.findByPostIdAndLocale(postId, locale).map(row -> new Stored(row.getSourceHash(),
                new TranslatedPost(row.getSourceLanguage(), row.getTitle(), row.getBody(), row.getImages()),
                row.getModel()));
    }

    /** Replaces the post's translation into the language, if any. */
    @Transactional
    public void save(UUID postId, String locale, String sourceHash, TranslatedPost post, String model, long input,
            long output, long costMicros, List<String> failedChecks) {
        var row = translations.findByPostIdAndLocale(postId, locale).orElseGet(PostTranslationRecord::new);
        row.setPostId(postId);
        row.setLocale(locale);
        row.setSourceHash(sourceHash);
        row.setSourceLanguage(post.sourceLanguage());
        row.setTitle(post.title());
        row.setBody(post.body());
        row.setImages(post.images());
        row.setModel(model);
        row.setInputTokens(input);
        row.setOutputTokens(output);
        row.setCostMicros(costMicros);
        row.setFailedChecks(failedChecks);
        row.setCreatedAt(clock.instant());
        translations.saveAndFlush(row);
    }

    @Transactional
    public void recordCall(long input, long output, long costMicros) {
        usage.add(month(), input, output, costMicros, clock.instant());
    }

    @Transactional(readOnly = true)
    public long spentThisMonth() {
        return usage.findById(month()).map(row -> row.getCostMicros()).orElse(0L);
    }

    private LocalDate month() {
        return LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC).withDayOfMonth(1);
    }
}
