package com.wikiaov.access.internal.infrastructure;

import com.wikiaov.access.Capabilities;
import com.wikiaov.platform.ApiPaths;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * HTTP security, layer 1 of 3.
 *
 * <ol>
 *   <li>URL rules here: public reads are open, the admin API of every version needs {@code catalog:read}.</li>
 *   <li>{@code @PreAuthorize} on each use case checks the specific capability.</li>
 *   <li>Data-dependent rules live in domain policies.</li>
 * </ol>
 *
 * <p>Signature, issuer, audience and expiry are validated by the auto-configured JWT decoder
 * ({@code spring.security.oauth2.resourceserver.jwt.*}); an empty subject is rejected by the converter.
 */
@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
@EnableConfigurationProperties(AccessProperties.class)
class SecurityConfiguration {

    @Bean
    SecurityFilterChain apiSecurityFilterChain(HttpSecurity http, AccessProperties properties,
            ProblemAuthenticationEntryPoint entryPoint,
            ProblemAccessDeniedHandler accessDeniedHandler) throws Exception {
        return http
                // Admin APIs use Bearer tokens. AuthController guards cookie writes with origin + X-AOV-Auth.
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(HttpMethod.GET, "/actuator/health", "/actuator/health/**",
                                "/actuator/info")
                        .permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/wiki/*/auth/login", "/api/wiki/*/auth/refresh",
                                "/api/wiki/*/auth/logout", "/api/wiki/*/auth/google")
                        .permitAll()
                        // Admin rules must come before the public GET rule; "*" covers every API version.
                        .requestMatchers(HttpMethod.POST, "/api/wiki/*/media/contact-requests").permitAll()
                        .requestMatchers("/api/wiki/*/users/**").authenticated()
                        .requestMatchers(ApiPaths.ANY_VERSION_ADMIN_PATTERN).hasAuthority(Capabilities.CATALOG_READ)
                        .requestMatchers(HttpMethod.GET, ApiPaths.ANY_VERSION_PATTERN).permitAll()
                        .requestMatchers(HttpMethod.HEAD, ApiPaths.ANY_VERSION_PATTERN).permitAll()
                        .anyRequest().denyAll())
                .oauth2ResourceServer(resourceServer -> resourceServer
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(
                                new KeycloakJwtAuthenticationConverter(properties.resourceClientId())))
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .build();
    }
}
