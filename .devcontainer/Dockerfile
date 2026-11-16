# Copying Go out of the official image takes seconds, where the devcontainers Go feature
# takes minutes. Pinned to 1.26.11, the version go.mod declares, CI's setup-go reads and the
# cmd/*/Dockerfile builders use: bump them together.
FROM golang:1.26.11-bookworm AS go

FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

ENV PATH="/usr/local/go/bin:${PATH}"

COPY --from=go /usr/local/go /usr/local/go
