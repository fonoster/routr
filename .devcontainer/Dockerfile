# Copying the JDK out of the Temurin image takes seconds, where the devcontainers Java
# feature (SDKMAN!) takes about seven minutes. Pinned to 17 on purpose, see
# .github/workflows/test.yaml (Mockito vs Java 21).
FROM eclipse-temurin:17-jdk AS jdk

FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="${JAVA_HOME}/bin:${PATH}"

COPY --from=jdk /opt/java/openjdk /opt/java/openjdk
