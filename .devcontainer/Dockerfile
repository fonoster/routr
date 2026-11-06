# Copying Go out of the official image takes seconds, where the devcontainers Go feature
# takes minutes. Pinned to the version mods/edgeport-go/go.mod declares and CI's setup-go reads.
FROM golang:1.24-bookworm AS go

FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

ENV PATH="/usr/local/go/bin:${PATH}"

COPY --from=go /usr/local/go /usr/local/go
