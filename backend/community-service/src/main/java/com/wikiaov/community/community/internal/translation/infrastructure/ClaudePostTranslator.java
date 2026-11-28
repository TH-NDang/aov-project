package com.wikiaov.community.community.internal.translation.infrastructure;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.errors.AnthropicException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.models.messages.Base64ImageSource;
import com.anthropic.models.messages.ContentBlockParam;
import com.anthropic.models.messages.ImageBlockParam;
import com.anthropic.models.messages.JsonOutputFormat;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.TextBlockParam;
import com.wikiaov.community.community.internal.translation.application.TranslationSettings;
import com.wikiaov.community.community.internal.translation.application.port.PostTranslator;
import com.wikiaov.community.community.internal.translation.domain.TranslatedPost;
import com.wikiaov.community.community.internal.translation.domain.TranslationLanguages;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Translates with the Claude API through the official Java SDK (ADR-037). The answer is held to a JSON schema whose
 * target language allows one value, so the model cannot answer in the post's own language by mistake.
 */
@Component
class ClaudePostTranslator implements PostTranslator, DisposableBean {
    private static final JsonMapper JSON = JsonMapper.builder()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build();

    private final TranslationSettings settings;
    private final @Nullable AnthropicClient client;

    ClaudePostTranslator(TranslationSettings settings) {
        this.settings = settings;
        // One retry inside the SDK for overloads and dropped connections; the checks decide on a second answer.
        this.client = settings.enabled()
                ? AnthropicOkHttpClient.builder().apiKey(settings.apiKey()).timeout(settings.timeout())
                        .maxRetries(1).build()
                : null;
    }

    @Override
    public Result translate(String target, String system, String text, List<Image> images, @Nullable Retry retry) {
        if (client == null) {
            throw new Failed("No Claude API key is set.", null);
        }
        var content = new ArrayList<ContentBlockParam>();
        for (var image : images) {
            content.add(ContentBlockParam.ofImage(ImageBlockParam.builder().source(Base64ImageSource.builder()
                    .data(Base64.getEncoder().encodeToString(image.data()))
                    .mediaType(Base64ImageSource.MediaType.of(image.mediaType())).build()).build()));
        }
        content.add(ContentBlockParam.ofText(TextBlockParam.builder().text(text).build()));

        var request = MessageCreateParams.builder().model(settings.model()).maxTokens(settings.maxOutputTokens())
                .system(system)
                .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.of(settings.effort()))
                        .format(JsonOutputFormat.builder().schema(schema(target)).build()).build())
                .addUserMessageOfContentBlockParams(content);
        if (retry != null) {
            request.addAssistantMessage(retry.previousAnswer()).addUserMessage(retry.failures());
        }

        Message message;
        try {
            message = client.messages().create(request.build());
        } catch (AnthropicServiceException failure) {
            throw new Failed("The Claude API answered " + failure.statusCode() + ".", failure);
        } catch (AnthropicException failure) {
            throw new Failed("The Claude API could not be reached: " + failure.getClass().getSimpleName() + ".",
                    failure);
        }
        var stop = message.stopReason().orElse(null);
        if (StopReason.REFUSAL.equals(stop) || StopReason.MAX_TOKENS.equals(stop)) {
            throw new Failed("The Claude API stopped with " + stop + ".", null);
        }
        String raw = message.content().stream().flatMap(block -> block.text().stream())
                .map(block -> block.text()).collect(Collectors.joining());
        return new Result(parse(raw, target), raw, message.model().asString(), message.usage().inputTokens(),
                message.usage().outputTokens());
    }

    static TranslatedPost parse(String raw, String target) {
        Answer answer;
        try {
            answer = JSON.readValue(raw, Answer.class);
        } catch (JacksonException failure) {
            throw new Failed("The answer is not the expected JSON.", failure);
        }
        if (answer == null || !target.equals(answer.targetLanguage()) || answer.body() == null
                || !TranslationLanguages.SOURCES.contains(answer.sourceLanguage())) {
            throw new Failed("The answer does not fit the schema.", null);
        }
        var images = new ArrayList<TranslatedPost.ImageText>();
        var listed = answer.images() == null ? List.<AnswerImage>of() : answer.images();
        for (int i = 0; i < listed.size(); i++) {
            var image = listed.get(i);
            images.add(new TranslatedPost.ImageText(i, image.hasText(), image.language(), image.translatedText()));
        }
        return new TranslatedPost(answer.sourceLanguage(), answer.title(), answer.body(), images);
    }

    static JsonOutputFormat.Schema schema(String target) {
        var schema = JsonOutputFormat.Schema.builder();
        schemaMap(target).forEach((key, value) -> schema.putAdditionalProperty(key, JsonValue.from(value)));
        return schema.build();
    }

    /** The answer's JSON schema; structured outputs need every object closed and every field required. */
    static Map<String, Object> schemaMap(String target) {
        var languages = new ArrayList<Object>(TranslationLanguages.SOURCES);
        Map<String, Object> image = object(Map.of(
                "index", Map.of("type", "integer"),
                "hasText", Map.of("type", "boolean"),
                "language", Map.of("anyOf", List.of(Map.of("type", "string", "enum", languages),
                        Map.of("type", "null"))),
                "translatedText", Map.of("anyOf", List.of(Map.of("type", "string"), Map.of("type", "null")))),
                List.of("index", "hasText", "language", "translatedText"));
        Map<String, Object> root = object(Map.of(
                "sourceLanguage", Map.of("type", "string", "enum", languages),
                "targetLanguage", Map.of("type", "string", "enum", List.of(target)),
                "title", Map.of("anyOf", List.of(Map.of("type", "string"), Map.of("type", "null"))),
                "body", Map.of("type", "string"),
                "images", Map.of("type", "array", "items", image)),
                List.of("sourceLanguage", "targetLanguage", "title", "body", "images"));
        return root;
    }

    private static Map<String, Object> object(Map<String, Object> properties, List<String> required) {
        var ordered = new LinkedHashMap<String, Object>();
        required.forEach(name -> ordered.put(name, properties.get(name)));
        var object = new LinkedHashMap<String, Object>();
        object.put("type", "object");
        object.put("properties", ordered);
        object.put("required", required);
        object.put("additionalProperties", false);
        return object;
    }

    @Override
    public void destroy() {
        if (client != null) {
            client.close();
        }
    }

    record Answer(
            String sourceLanguage,
            String targetLanguage,
            @Nullable String title,
            String body,
            @Nullable List<AnswerImage> images
    ) {
    }

    record AnswerImage(
            int index,
            boolean hasText,
            @Nullable String language,
            @Nullable String translatedText
    ) {
    }
}
