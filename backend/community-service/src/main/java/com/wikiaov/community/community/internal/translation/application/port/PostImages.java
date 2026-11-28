package com.wikiaov.community.community.internal.translation.application.port;

import java.util.List;
import java.util.Optional;

/** Downloads a post's images for the model, as Claude cannot reach the site's image host itself. */
public interface PostImages {
    /** One entry per URL, in order; empty where an image is on another host, too large or could not be read. */
    List<Optional<PostTranslator.Image>> load(List<String> urls);
}
