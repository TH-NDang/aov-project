package com.wikiaov.community.tournament.internal.web;

import java.time.Duration;
import java.util.function.Supplier;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.context.request.WebRequest;

/** Public answers a browser keeps for a few minutes and then asks for again by their tag. */
final class TaggedAnswers {
    private static final CacheControl CACHE = CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic();

    private TaggedAnswers() {
    }

    /** The answer named by {@code tag}, or that it has not changed when the browser still holds it. */
    static <T> ResponseEntity<T> answer(WebRequest web, String tag, Supplier<T> answer) {
        var quoted = "\"" + tag + "\"";
        if (web.checkNotModified(quoted)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(quoted).cacheControl(CACHE).build();
        }

        return ResponseEntity.ok().eTag(quoted).cacheControl(CACHE).body(answer.get());
    }
}
