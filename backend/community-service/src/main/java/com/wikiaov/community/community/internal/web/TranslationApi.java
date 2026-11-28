package com.wikiaov.community.community.internal.web;

import com.wikiaov.community.community.internal.translation.application.PostTranslationView;
import com.wikiaov.community.community.internal.translation.application.TranslationStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;

@Tag(name = "translation")
public interface TranslationApi {
    @Operation(operationId = "translationApi_status", summary = "Whether posts can be translated", description = "Public. `enabled` is false while no Claude API key is set or this month's translation budget is spent; Stream then hides its Translate button. `locales` are the languages posts are translated into.", responses = {
            @ApiResponse(responseCode = "200", description = "The translation status.", useReturnTypeSchema = true)
    })
    TranslationStatus status();

    @Operation(operationId = "translationApi_post", summary = "A post in another language", description = "Public; a signed-in reader is counted by account, anyone else by address. The published post in `locale`, made with the Claude API on the first request and kept until the post changes (ADR-037). Game names follow the shared terminology of wiki-service. `images` says, in the post's order, what each image's text says in that language. A post already written in `locale` and without images comes back as it is, with `sameLanguage` true and no call to the model. Each account or address may start a limited number of new translations an hour; reading a kept one is not counted.", responses = {
            @ApiResponse(responseCode = "200", description = "The post in the requested language.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "400", description = "`TRANSLATION_UNSUPPORTED_LOCALE`: posts are not translated into that language; `locales` in the problem lists those they are. Also an unknown query parameter.", content = @Content(mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class))),
            @ApiResponse(responseCode = "404", description = "`PAGE_NOT_FOUND`: no such published post on a published page.", content = @Content(mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class))),
            @ApiResponse(responseCode = "429", description = "`TRANSLATION_RATE_LIMITED`: too many new translations from this account or address in the last hour.", content = @Content(mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class))),
            @ApiResponse(responseCode = "502", description = "`TRANSLATION_FAILED`: the Claude API failed or gave an unusable answer; trying again later may work.", content = @Content(mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class))),
            @ApiResponse(responseCode = "503", description = "`TRANSLATION_UNAVAILABLE`: translation is off (`reason` `disabled`) or this month's budget is spent (`reason` `budget`).", content = @Content(mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class)))
    })
    ResponseEntity<PostTranslationView> post(UUID id,
            @Parameter(description = "The language to read the post in, such as en-US.") String locale);
}
