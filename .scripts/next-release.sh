#!/bin/bash
# Prints the release the commits since the last tag call for (major, minor, patch or none),
# read from their conventional-commit subjects. Only commits that change what ships count:
# test, style, docs, chore, ci and build release nothing. The Release workflow runs on it, so a
# subject alone decides whether main ships.

set -e

git fetch --tags --quiet

latest_tag=$(git describe --tags --abbrev=0)
commit_messages=$(git log --pretty=format:"%s" $latest_tag..HEAD)
release_type="none"

while IFS= read -r line; do
  if echo "$line" | grep -Eq "^BREAKING CHANGE:|^[a-z]+(\([^)]*\))?!:"; then
    release_type="major"
    break
  elif echo "$line" | grep -Eq "^feat(\(|:)"; then
    release_type="minor"
  elif echo "$line" | grep -Eq "^(fix|refactor|perf|revert)(\(|:)"; then
    if [ "$release_type" != "minor" ]; then
      release_type="patch"
    fi
  fi
done <<< "$commit_messages"

echo $release_type
