#!/usr/bin/env bash
# Local load test (PG-5). Builds nothing and deploys nothing: it runs the production image of the API in a container
# with a CPU and memory limit, on its own database inside the compose Postgres, then drives it with k6 from a second
# container on the same network. It never talks to the deployed service, Neon or PayPal (payments are simulated).
#
#   docker compose up -d db
#   docker build -t sentrix-api-loadtest backend
#   CPUS=0.5 TAG=half-cpu bash backend/loadtest/run.sh
#   SKIP_LIMITS=1 LISTS_RATES=80,120,200 SCORING_RATES=30,40,60 TAG=half-cpu-knee bash backend/loadtest/run.sh
#
# Results go to backend/loadtest/results/$TAG/*.json (k6 summaries) and *.log.
set -euo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash on Windows rewrites arguments that start with a slash

CPUS="${CPUS:-0.5}"
MEMORY="${MEMORY:-512m}"
TAG="${TAG:-cpu-${CPUS}}"
NETWORK="${NETWORK:-fintech-fraud-detection_default}"
DB_NAME="loadtest"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/results/$TAG"
mkdir -p "$OUT"

psql_db() { docker compose exec -T db psql -U postgres -d postgres -c "$1" > /dev/null; }

cleanup() {
  docker rm -f sentrix-loadtest > /dev/null 2>&1 || true
}
trap cleanup EXIT

start_api() { # $1 = RATE_LIMITS value ("" keeps the shipped limits)
  cleanup
  docker run -d --name sentrix-loadtest --network "$NETWORK" --cpus "$CPUS" --memory "$MEMORY" \
    -e DATABASE_URL="postgres://postgres:postgres@db:5432/$DB_NAME" -e SECRET_KEY_BASE=loadtest-only \
    -e FRONTEND_URL=http://localhost:5173 -e APP_HOST=sentrix-loadtest -e SOLID_QUEUE_IN_PUMA=true \
    -e WEB_CONCURRENCY=1 -e RAILS_MAX_THREADS=3 ${1:+-e RATE_LIMITS=$1} sentrix-api-loadtest > /dev/null
  for _ in $(seq 1 60); do
    if docker run --rm --network "$NETWORK" curlimages/curl -fsS "http://sentrix-loadtest:3000/up" > /dev/null 2>&1; then return 0; fi
    sleep 2
  done
  echo "API did not come up"; docker logs sentrix-loadtest | tail -20; exit 1
}

k6run() { # $1 = name, rest = env for k6
  local name="$1"; shift
  docker run --rm --network "$NETWORK" -v "$HERE:/scripts" -v "$OUT:/out" -e BASE_URL=http://sentrix-loadtest:3000 "$@" \
    grafana/k6 run --quiet --summary-export "/out/$name.json" /scripts/k6.js 2>&1 | tee "$OUT/$name.log"
}

psql_db "DROP DATABASE IF EXISTS $DB_NAME"
psql_db "CREATE DATABASE $DB_NAME"

# Phase 1: the limits as shipped. Fresh database, rate limits on.
start_api ""
docker exec -i sentrix-loadtest bin/rails runner - < "$HERE/seed.rb" | tail -1
[ -n "${SKIP_LIMITS:-}" ] || k6run limits -e WORKLOAD=limits

# Phase 2: capacity of the app itself. Same image, rate limits off (they allow about 2 requests a second per address).
start_api off
docker exec sentrix-loadtest bin/rails demo:judges | tail -1
docker exec -i sentrix-loadtest bin/rails runner - < "$HERE/seed.rb" | tail -1
docker exec -e CONFIRM=yes sentrix-loadtest bin/rails demo:traffic | tail -1 || true
k6run lists -e WORKLOAD=lists -e RATES="${LISTS_RATES:-5,10,20,40}"
k6run staff -e WORKLOAD=staff -e RATES="${STAFF_RATES:-5,10,20,40}"
k6run scoring -e WORKLOAD=scoring -e RATES="${SCORING_RATES:-2,5,10,20}"
docker stats --no-stream sentrix-loadtest --format "memory={{.MemUsage}} cpu={{.CPUPerc}}" | tee "$OUT/docker-stats.log"
docker logs sentrix-loadtest 2>&1 | grep -c '"level":"error"' | sed 's/^/error_log_lines=/' | tee -a "$OUT/docker-stats.log"
psql_db "DROP DATABASE IF EXISTS $DB_NAME" || true
