package com.wikiaov.platform.internal.web;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Paths;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.ArraySchema;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.security.SecurityScheme;
import java.util.Comparator;
import java.util.LinkedHashMap;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
class OpenApiConfiguration {
    @Bean
    OpenApiCustomizer concreteVersionPaths() {
        return api -> {
            if (api.getPaths() == null) {
                return;
            }
            var paths = new Paths();
            api.getPaths().forEach((path, item) -> {
                String concrete = path.replace("{apiVersion}", "v1").replaceFirst("^/api/wiki/1/", "/api/wiki/v1/");
                if (item.getParameters() != null) {
                    item.getParameters().removeIf(parameter -> "apiVersion".equals(parameter.getName()));
                }
                item.readOperations().forEach(operation -> {
                    if (operation.getParameters() != null) {
                        operation.getParameters().removeIf(parameter -> "apiVersion".equals(parameter.getName()));
                    }
                });
                if (paths.put(concrete, item) != null) {
                    throw new IllegalStateException("Duplicate versioned OpenAPI path: " + concrete);
                }
            });
            api.setPaths(paths);
        };
    }

    /**
     * The problem responses every operation shares, declared once instead of on each {@code *Api} method: a default
     * RFC 9457 problem, and for operations that need a bearer token the 401 and 403 answers. An operation that documents
     * one of these codes itself keeps its own wording. Responses are listed by status code, the default last.
     */
    @Bean
    OpenApiCustomizer commonProblemResponses() {
        return api -> {
            if (api.getPaths() == null) {
                return;
            }
            api.getPaths().values().forEach(item -> item.readOperations().forEach(operation -> {
                var responses = new LinkedHashMap<String, ApiResponse>();
                if (operation.getResponses() != null) {
                    responses.putAll(operation.getResponses());
                }
                boolean secured = operation.getSecurity() != null && operation.getSecurity().stream()
                        .anyMatch(requirement -> requirement.containsKey("bearerAuth"));

                if (secured) {
                    responses.putIfAbsent("401", problem("A valid bearer access token is required."));
                    responses.putIfAbsent("403", problem(
                            "The authenticated actor lacks a required capability or fails an authorization rule."));
                }
                responses.putIfAbsent("default", problem("Failure expressed as RFC 9457 Problem Details, "
                        + "including the module-specific code and requestId when available."));

                var ordered = new ApiResponses();
                if (operation.getResponses() != null) {
                    ordered.setExtensions(operation.getResponses().getExtensions());
                }
                responses.entrySet().stream()
                        .sorted(Comparator.comparing(entry -> "default".equals(entry.getKey()) ? "~" : entry.getKey()))
                        .forEach(entry -> ordered.addApiResponse(entry.getKey(), entry.getValue()));
                operation.setResponses(ordered);
            }));
        };
    }

    private static ApiResponse problem(String description) {
        return new ApiResponse().description(description).content(new Content().addMediaType("application/problem+json",
                new MediaType().schema(new Schema<>().$ref("#/components/schemas/ApiProblem"))));
    }

    @Bean
    OpenAPI wikiOpenApi() {
        var fieldError = new ObjectSchema()
                .addProperty("path", new StringSchema())
                .addProperty("code", new StringSchema())
                .addProperty("message", new StringSchema());
        var problem = new ObjectSchema()
                .addProperty("type", new StringSchema().format("uri-reference"))
                .addProperty("title", new StringSchema())
                .addProperty("status", new IntegerSchema().format("int32"))
                .addProperty("detail", new StringSchema())
                .addProperty("instance", new StringSchema().format("uri-reference"))
                .addProperty("code", new StringSchema())
                .addProperty("requestId", new StringSchema())
                .addProperty("errors", new ArraySchema().items(fieldError))
                .addProperty("context", new ObjectSchema().additionalProperties(true));
        return new OpenAPI()
                .info(new Info().title("WikiAOV API").version("1")
                        .description("Generated from the implemented HTTP API interfaces. "
                                + "Only API version v1 is supported. Public GET/HEAD requests do not require a token; "
                                + "admin requests require catalog:read and application-specific capabilities. "
                                + "User profile endpoints require authentication. Authentication writes instead use "
                                + "an exact configured Origin and X-AOV-Auth: 1. Errors use application/problem+json. "
                                + "Dynamic map responses retain their existing flexible shape; they are not narrowed "
                                + "to a speculative DTO by this document."))
                .components(new Components().addSchemas("ApiProblem", problem)
                        .addSecuritySchemes("bearerAuth", new SecurityScheme().type(SecurityScheme.Type.HTTP)
                                .scheme("bearer").bearerFormat("JWT")
                                .description(
                                        "Keycloak access token. Capabilities come from the configured resource client; "
                                                + "the server also checks issuer, audience, expiration and subject.")));
    }
}
