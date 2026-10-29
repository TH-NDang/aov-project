package com.wikiaov.community.platform;

import java.util.*;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableMethodSecurity
class SecurityConfiguration {
    @Bean
    SecurityFilterChain security(HttpSecurity http) throws Exception {
        return http.csrf(AbstractHttpConfigurer::disable).cors(c -> {
        }).sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(a -> a.requestMatchers("/actuator/health", "/error").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/api/community/**").permitAll()
                        .requestMatchers("/api/community/*/admin/**").hasAuthority("tournament:read")
                        .requestMatchers(HttpMethod.GET, "/api/community/*/**").permitAll().anyRequest().denyAll())
                .oauth2ResourceServer(o -> o.jwt(j -> j.jwtAuthenticationConverter(jwt -> {
                    if (jwt.getSubject() == null || jwt.getSubject().isBlank())
                        throw new org.springframework.security.oauth2.server.resource.InvalidBearerTokenException(
                                "Token subject is required");
                    Map<String, Object> resources = jwt.getClaimAsMap("resource_access");
                    Object client = resources == null ? null : resources.get("community-service");
                    Object roles = client instanceof Map<?, ?> map ? map.get("roles") : null;
                    var authorities = roles instanceof Collection<?> values
                            ? values.stream().filter(String.class::isInstance)
                                    .map(role -> new SimpleGrantedAuthority((String) role)).toList()
                            : List.<SimpleGrantedAuthority>of();
                    return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
                }))).build();
    }
}
