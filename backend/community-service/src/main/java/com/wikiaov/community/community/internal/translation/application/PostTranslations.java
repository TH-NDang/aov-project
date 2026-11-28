package com.wikiaov.community.community.internal.translation.application;

import com.wikiaov.community.community.internal.translation.application.port.GlossarySource;
import com.wikiaov.community.community.internal.translation.application.port.PostImages;
import com.wikiaov.community.community.internal.translation.application.port.PostTranslator;
import com.wikiaov.community.community.internal.translation.domain.PostLanguage;
import com.wikiaov.community.community.internal.translation.domain.TranslatedPost;
import com.wikiaov.community.community.internal.translation.domain.TranslatedPost.ImageText;
import com.wikiaov.community.community.internal.translation.domain.TranslationChecks;
import com.wikiaov.community.community.internal.translation.domain.TranslationPrompt;
import com.wikiaov.community.platform.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Translates a published post into a reader's language with the Claude API, once per post, language and text
 * (ADR-037). A post already in that language and without images is answered without a call.
 */
@Service
public class PostTranslations {
    private static final Logger log = LoggerFactory.getLogger(PostTranslations.class);

    private final TranslationSettings settings;
    private final TranslationStore store;
    private final PostTranslator translator;
    private final GlossarySource glossary;
    private final PostImages images;
    private final TranslationLimiter limiter;
    /** Translations being made now, so two readers of a new post share one call. */
    private final Map<String, CompletableFuture<PostTranslationView>> running = new ConcurrentHashMap<>();

    PostTranslations(TranslationSettings settings, TranslationStore store, PostTranslator translator,
            GlossarySource glossary, PostImages images, TranslationLimiter limiter) {
        this.settings = settings;
        this.store = store;
        this.translator = translator;
        this.glossary = glossary;
        this.images = images;
        this.limiter = limiter;
    }

    public TranslationStatus status() {
        boolean enabled = settings.enabled() && store.spentThisMonth() < settings.monthlyBudgetMicros();
        return new TranslationStatus(enabled, settings.locales());
    }

    /**
     * @param requester
     *            the account or address the hourly limit counts against
     */
    public PostTranslationView translate(UUID postId, String locale, String requester) {
        if (!settings.locales().contains(locale)) {
            throw new ApiException(TranslationErrorCode.TRANSLATION_UNSUPPORTED_LOCALE,
                    "Posts are translated into " + String.join(", ", settings.locales()) + ".",
                    Map.of("locales", settings.locales()));
        }
        var post = store.published(postId);
        var urls = post.imageUrls().stream().limit(settings.maxImages()).toList();
        String hash = hash(post, urls);
        var stored = store.stored(postId, locale);
        if (stored.isPresent() && stored.get().sourceHash().equals(hash)) {
            return PostTranslationView.of(postId, locale, stored.get().post(), stored.get().model());
        }
        String guessed = PostLanguage.guess(join(post.title(), post.body()));
        if (urls.isEmpty() && locale.equals(guessed)) {
            return new PostTranslationView(postId, locale, guessed, true, post.title(), post.body(), List.of(),
                    null);
        }
        if (!settings.enabled()) {
            throw unavailable("Translation is not set up.", "disabled");
        }

        String key = postId + ":" + locale + ":" + hash;
        var mine = new CompletableFuture<PostTranslationView>();
        var other = running.putIfAbsent(key, mine);
        if (other != null) {
            return await(other);
        }
        try {
            var view = fresh(post, urls, locale, hash, requester);
            mine.complete(view);
            return view;
        } catch (RuntimeException failure) {
            mine.completeExceptionally(failure);
            throw failure;
        } finally {
            running.remove(key, mine);
        }
    }

    private PostTranslationView fresh(TranslationStore.Post post, List<String> urls, String locale, String hash,
            String requester) {
        if (!limiter.tryStart(requester)) {
            throw new ApiException(TranslationErrorCode.TRANSLATION_RATE_LIMITED,
                    "Too many new translations in the last hour. Try again later.");
        }
        if (store.spentThisMonth() >= settings.monthlyBudgetMicros()) {
            throw unavailable("This month's translation budget is spent.", "budget");
        }

        var loaded = images.load(urls);
        var attached = loaded.stream().flatMap(Optional::stream).toList();
        var words = glossary.glossary();
        var lines = words.lines(join(post.title(), post.body()), locale, !attached.isEmpty());
        String system = TranslationPrompt.system(locale, lines, attached.size());
        String text = TranslationPrompt.post(post.title(), post.body(), attached.size());
        var source = new TranslationChecks.Source(post.title(), post.body(), attached.size());

        var first = call(locale, system, text, attached, null);
        var best = first;
        var failures = TranslationChecks.failures(source, first.post(), locale, lines, words.keptNames());
        long input = first.inputTokens();
        long output = first.outputTokens();
        if (!failures.isEmpty()) {
            try {
                var second = call(locale, system, text, attached,
                        new PostTranslator.Retry(first.raw(), TranslationPrompt.retry(failures)));
                input += second.inputTokens();
                output += second.outputTokens();
                var again = TranslationChecks.failures(source, second.post(), locale, lines, words.keptNames());
                log.info("Translation of post {} into {} retried: {} failed check(s), then {}", post.id(), locale,
                        failures.size(), again.size());
                if (again.size() <= failures.size()) {
                    best = second;
                    failures = again;
                }
            } catch (ApiException retryFailed) {
                log.warn("Retry of the translation of post {} into {} failed; the first answer is kept", post.id(),
                        locale);
            }
        }

        var translated = inPostOrder(best.post(), loaded);
        // A post whose images could not all be read is translated again next time, with them.
        if (attached.size() == urls.size()) {
            store.save(post.id(), locale, hash, translated, best.model(), input, output,
                    settings.costMicros(input, output), failures);
        }
        return PostTranslationView.of(post.id(), locale, translated, best.model());
    }

    private PostTranslator.Result call(String locale, String system, String text, List<PostTranslator.Image> images,
            PostTranslator.@Nullable Retry retry) {
        PostTranslator.Result result;
        try {
            result = translator.translate(locale, system, text, images, retry);
        } catch (PostTranslator.Failed failure) {
            log.warn("Claude API translation failed: {}", failure.getMessage());
            throw new ApiException(TranslationErrorCode.TRANSLATION_FAILED,
                    "The translation could not be made. Try again later.");
        }
        store.recordCall(result.inputTokens(), result.outputTokens(),
                settings.costMicros(result.inputTokens(), result.outputTokens()));
        return result;
    }

    /** The model numbers only the images it was sent; the answer numbers every image of the post. */
    static TranslatedPost inPostOrder(TranslatedPost answer, List<Optional<PostTranslator.Image>> loaded) {
        var texts = new ArrayList<ImageText>();
        int sent = 0;
        for (int index = 0; index < loaded.size(); index++) {
            if (loaded.get(index).isEmpty() || sent >= answer.images().size()) {
                if (loaded.get(index).isPresent()) {
                    sent++;
                }
                texts.add(new ImageText(index, false, null, null));
                continue;
            }
            var text = answer.images().get(sent++);
            texts.add(new ImageText(index, text.hasText(), text.language(), text.hasText() ? text.text() : null));
        }
        return new TranslatedPost(answer.sourceLanguage(), answer.title(), answer.body(), texts);
    }

    private String hash(TranslationStore.Post post, List<String> urls) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            String value = settings.model() + "\n" + TranslationPrompt.VERSION + "\n"
                    + (post.title() == null ? "" : post.title()) + "\u0000" + post.body() + "\u0000"
                    + String.join("\n", urls);
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static PostTranslationView await(CompletableFuture<PostTranslationView> other) {
        try {
            return other.join();
        } catch (CompletionException failure) {
            if (failure.getCause() instanceof RuntimeException cause) {
                throw cause;
            }
            throw failure;
        }
    }

    private static ApiException unavailable(String detail, String reason) {
        return new ApiException(TranslationErrorCode.TRANSLATION_UNAVAILABLE, detail, Map.of("reason", reason));
    }

    private static String join(@Nullable String title, String body) {
        return (title == null ? "" : title + "\n") + body;
    }
}
