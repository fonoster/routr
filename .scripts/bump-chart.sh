#!/bin/bash
# Points the Helm chart at a Routr release: sets appVersion and bumps the chart's own
# patch version, since a chart whose contents changed must carry a new version
# (the chart and app versions are independent, as Helm recommends). Lerna runs it as the
# root "version" script, so the bump lands in the release commit; safe to run by hand.
# No-op when appVersion already matches, so a re-run does not bump the chart twice.
#
#   .scripts/bump-chart.sh <app-version> [path/to/Chart.yaml]

set -e

app_version="$1"
chart="${2:-ops/charts/connect/Chart.yaml}"

[ -z "$app_version" ] && { echo "usage: $0 <app-version> [Chart.yaml]"; exit 1; }
[ -f "$chart" ] || { echo "no chart at $chart"; exit 1; }

current_app=$(sed -n 's/^appVersion: *//p' "$chart")
current_chart=$(sed -n 's/^version: *//p' "$chart")

if [ "$current_app" = "$app_version" ]; then
  echo "chart already at appVersion $app_version (chart $current_chart)"
  exit 0
fi

IFS=. read -r major minor patch <<< "$current_chart"
next_chart="$major.$minor.$((patch + 1))"

sed -i.bak \
  -e "s/^version: .*/version: $next_chart/" \
  -e "s/^appVersion: .*/appVersion: $app_version/" "$chart"
rm -f "$chart.bak"

echo "chart $current_chart -> $next_chart, appVersion $current_app -> $app_version"
