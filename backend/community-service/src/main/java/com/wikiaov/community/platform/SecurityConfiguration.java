package com.wikiaov.community.platform;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableMethodSecurity
class SecurityConfiguration {
    @Bean
    SecurityFilterChain security(HttpSecurity http, ProblemAuthenticationEntryPoint entryPoint,
            ProblemAccessDeniedHandler accessDeniedHandler,
            @Value("${community.security.capability-clients:admin-aov-backend}") List<String> capabilityClients)
            throws Exception {
        return http.csrf(AbstractHttpConfigurer::disable).cors(c -> {
        }).sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(a -> a.requestMatchers("/actuator/health", "/error").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/api/community/**").permitAll()
                        .requestMatchers("/api/community/*/admin/**").hasAuthority("tournament:read")
                        .requestMatchers("/api/community/*/me", "/api/community/*/me/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/community/*/**").permitAll().anyRequest().denyAll())
                .oauth2ResourceServer(o -> o.jwt(j -> j.jwtAuthenticationConverter(
                        new CommunityJwtAuthenticationConverter(capabilityClients)))
                        .authenticationEntryPoint(entryPoint).accessDeniedHandler(accessDeniedHandler))
                .exceptionHandling(e -> e.authenticationEntryPoint(entryPoint).accessDeniedHandler(accessDeniedHandler))
                .build();
    }
}
