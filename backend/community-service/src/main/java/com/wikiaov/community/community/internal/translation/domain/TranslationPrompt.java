package com.wikiaov.community.community.internal.translation.domain;

import java.util.List;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;

/**
 * The words sent to the model. The rules were tried on 40 sample posts with Claude Haiku 5.5 on 2026-11-28 (ADR-037):
 * a glossary of only the names a post uses, the target language locked in the answer's schema and checks with one
 * retry took game-term misses from 22 to 0.
 */
public final class TranslationPrompt {
    /** Part of every stored translation's hash: a new version makes posts translate again. */
    public static final String VERSION = "2026-11-28.1";

    private TranslationPrompt() {
    }

    public static String system(String target, List<Glossary.Line> lines, int images) {
        String language = TranslationLanguages.name(target);
        var prompt = new StringBuilder();
        prompt.append("""
                You translate community posts on a fan site for the mobile MOBA Arena of Valor (Vietnamese: Liên Quân \
                Mobile, Thai: RoV). Readers are players, so translate the way players talk in %1$s, not word for word.

                Rules
                1. Write the title, the body and every image text in %1$s only, whatever language the post is in. If \
                the title or body is already in %1$s, copy it unchanged.
                2. Game terms: when a glossary entry below matches, use its %1$s term exactly. The glossary wins over \
                your own knowledge. For a game term that is not in the glossary, use the name %1$s-speaking players \
                use; if you are not sure, keep the source word rather than inventing one.
                3. Keep unchanged: every <ref=kind:id>...</ref> tag, the whole tag including the text inside it, in \
                the same order; names of heroes, skins, players, teams and tournaments, even when a skin name has \
                glossary words in it; hashtags, @mentions, URLs and emoji.
                4. Numbers and dates: keep every value, written the way %1$s readers write them (%2$s).
                5. Abbreviations and slang become the matching %1$s words or slang.
                6. Keep the tone and the line breaks. Casual stays casual. Do not add or drop sentences, explanations \
                or emoji.
                7. Images, in the order given: hasText is true only if the image shows readable words. Then say in \
                %1$s, in one or two sentences, what the image says: the screen, the key labels, names and numbers. \
                Translate UI labels with the glossary and leave no source-language words except names. With no \
                readable text, hasText is false, language is null and translatedText is null.
                8. sourceLanguage is the language of the body.
                """.formatted(language, TranslationLanguages.numbers(target)));
        if (images > 0) {
            prompt.append("""
                    9. In shop screens, the second price next to the gold price is the premium currency (Vietnamese: \
                    Quân Huy). An empty slot on an arcana page is an arcana slot.
                    """);
        }
        prompt.append("\nGlossary (source -> ").append(language).append(")\n");
        if (lines.isEmpty()) {
            prompt.append("(none)\n");
        } else {
            prompt.append(lines.stream().map(line -> line.source() + " -> " + line.target())
                    .collect(Collectors.joining("\n"))).append('\n');
        }
        prompt.append("""

                Examples of the style (not from this post)
                vi -> en: "Laville giờ bá quá, cấu máu đau mà vẫn gánh được. Nhớ mang Trừng trị nha ae" -> "Laville \
                is busted right now, his poke hurts and he can still carry. Remember to bring Punish, guys"
                en -> vi: "Abyssal Dragon is up in 30s, don't get caught warding alone." -> "Rồng sắp lên sau 30 \
                giây, đừng đi cắm mắt một mình rồi bị bắt."
                th -> vi: "ป่าเราฟาร์มไม่ทัน โดนขโมยบัฟแดงอีกแล้ว" -> "Đi rừng bên mình farm không kịp, lại bị cướp \
                bùa đỏ rồi."
                """);
        return prompt.toString();
    }

    /** The post itself, after its images. */
    public static String post(@Nullable String title, String body, int images) {
        return "Title: " + (title == null || title.isBlank() ? "(none)" : title) + "\n" + "Images: " + images
                + (images > 0 ? " (attached above, in order)" : "") + "\nBody:\n" + body;
    }

    /** Asks for a second answer that fixes what the checks found. */
    public static String retry(List<String> failures) {
        return "Your answer did not pass these checks:\n- " + String.join("\n- ", failures)
                + "\nAnswer again with the whole translation, fixed. Keep skin, hero, player and team names as "
                + "written in the post.";
    }
}
