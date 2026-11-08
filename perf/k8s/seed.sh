#!/usr/bin/env bash
#
# Seeds the Connect chart's Postgres with the Domain, Credentials and Agents of a
# benchmark's SIPp users files, the database twin of gen_resources.js (which writes the
# same resources for the files backend). perfkit runs it on the machine that drives the
# run, with KUBECONFIG set, after the chart is Ready.
#
#   seed.sh <namespace> <users.csv>...
#
# Each file's rows start with <username>;<password>. The schema is Routr's v2 schema,
# which Routr 3 reads unchanged; Credentials passwords are stored in clear because the
# chart sets no CLOAK_ENCRYPTION_KEY.
set -euo pipefail

ns=${1:?usage: seed.sh <namespace> <users.csv>...}
shift

pod=$(kubectl -n "$ns" get pods -l app.kubernetes.io/name=postgresql \
  -o jsonpath='{.items[0].metadata.name}')

{
  echo "BEGIN;"
  echo "INSERT INTO domains (api_version, ref, name, domain_uri, updated_at)"
  echo "  VALUES ('v2', 'domain-bench', 'Benchmarks', 'bench.routr.local', now())"
  echo "  ON CONFLICT (ref) DO NOTHING;"
  # Every users file, header lines (SEQUENTIAL, RANDOM, ...) skipped, one row per user
  awk -F';' 'NF >= 2 && $1 !~ /^[A-Z]+$/ && !seen[$1]++ {
    printf "INSERT INTO credentials (api_version, ref, name, username, password, updated_at) VALUES (%cv2%c, %ccred-%s%c, %c%s credentials%c, %c%s%c, %c%s%c, now()) ON CONFLICT (ref) DO NOTHING;\n", 39,39, 39,$1,39, 39,$1,39, 39,$1,39, 39,$2,39
    printf "INSERT INTO agents (api_version, ref, domain_ref, credentials_ref, name, username, privacy, expires, updated_at) VALUES (%cv2%c, %cagent-%s%c, %cdomain-bench%c, %ccred-%s%c, %c%s%c, %c%s%c, %cNONE%c, 3600, now()) ON CONFLICT (username) DO NOTHING;\n", 39,39, 39,$1,39, 39,39, 39,$1,39, 39,$1,39, 39,$1,39, 39,39
  }' "$@"
  echo "COMMIT;"
} | kubectl -n "$ns" exec -i "$pod" -- \
  env PGPASSWORD=changeme psql -q -v ON_ERROR_STOP=1 -U routr -d routr

count=$(kubectl -n "$ns" exec "$pod" -- \
  env PGPASSWORD=changeme psql -tA -U routr -d routr -c "SELECT count(*) FROM agents")
echo "seeded: ${count} agents"
