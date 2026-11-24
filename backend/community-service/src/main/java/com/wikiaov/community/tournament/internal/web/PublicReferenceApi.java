package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.tournament.internal.reference.application.ReferenceViews.Names;
import com.wikiaov.community.tournament.internal.reference.application.ReferenceViews.Preview;
import com.wikiaov.community.tournament.internal.reference.domain.ReferenceKind;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.context.request.WebRequest;

@Tag(name = "references")
public interface PublicReferenceApi {
    @Operation(operationId = "publicReferenceApi_names", summary = "List circuits, organizations, competitions and teams a text can name")
    ResponseEntity<Names> names(@Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) WebRequest web);

    @Operation(operationId = "publicReferenceApi_people", summary = "List players and personnel a text can name")
    ResponseEntity<Names> people(@Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) WebRequest web);

    @Operation(operationId = "publicReferenceApi_preview", summary = "Read the preview of what a text names")
    ResponseEntity<Preview> preview(ReferenceKind kind, UUID id,
            @Parameter(hidden = true) HttpServletRequest request, @Parameter(hidden = true) WebRequest web);
}
