# syntax=docker/dockerfile:1
# Keycloak in production mode with the AOV login theme and the realm template baked in.
# Build context is backend/wiki-service/infra/local/keycloak-themes; Compose passes this folder as context `keycloak`.

FROM quay.io/keycloak/keycloak:26.8.2 AS build
COPY aov-public /opt/keycloak/themes/aov-public
COPY aov-admin /opt/keycloak/themes/aov-admin
ENV KC_DB=postgres \
    KC_HEALTH_ENABLED=true \
    KC_HTTP_RELATIVE_PATH=/idp
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.8.2 AS runtime
COPY --from=build /opt/keycloak/ /opt/keycloak/
# One instance, so no cluster: a clustered node waits on dead members after every restart. This is read at runtime.
ENV KC_CACHE=local
# Imported once when the realm does not exist; ${...} placeholders resolve from the environment at that moment.
COPY --from=keycloak wikiaov-realm.json /opt/keycloak/data/import/wikiaov-realm.json
# The image has neither curl nor wget.
HEALTHCHECK --interval=10s --timeout=5s --start-period=10m --retries=6 \
    CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/9000 && printf "GET /idp/health/ready HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n" >&3 && grep --quiet "\"UP\"" <&3' || exit 1
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized", "--import-realm"]
