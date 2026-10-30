\set ON_ERROR_STOP on
\timing off
DROP SCHEMA IF EXISTS perf CASCADE; CREATE SCHEMA perf; SET search_path = perf;
CREATE TABLE tx (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), amount numeric(15,2) NOT NULL, created_at timestamp NOT NULL, status varchar NOT NULL DEFAULT 'FLAGGED', user_id bigint NOT NULL, paypal_status varchar, risk_score int DEFAULT 0, updated_at timestamp NOT NULL DEFAULT now());
-- 300k payments over 200 users (customer 1 has 30k), 90 days; 2% held
INSERT INTO tx (amount, created_at, user_id, paypal_status, risk_score)
SELECT (random()*500+1)::numeric(15,2), now() - (random()*90 || ' days')::interval,
       CASE WHEN g <= 30000 THEN 1 ELSE 2 + (random()*198)::int END,
       CASE WHEN random() < 0.02 THEN 'HELD' WHEN random() < 0.7 THEN 'CAPTURED' ELSE 'VOIDED' END, (random()*100)::int
FROM generate_series(1, 300000) g;
CREATE INDEX tx_created_at ON tx (created_at);
CREATE INDEX tx_paypal_status ON tx (paypal_status);
CREATE INDEX tx_user_id ON tx (user_id);
ANALYZE tx;
\echo === BEFORE: first page, customer 1 (offset 0)
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SUMMARY ON) SELECT * FROM tx WHERE user_id = 1 ORDER BY created_at DESC, id DESC LIMIT 10 OFFSET 0;
\echo === BEFORE: page 2500 (offset 24990)
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SUMMARY ON) SELECT * FROM tx WHERE user_id = 1 ORDER BY created_at DESC, id DESC LIMIT 10 OFFSET 24990;
\echo === BEFORE: review queue first page
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SUMMARY ON) SELECT * FROM tx WHERE paypal_status IN ('HELD') ORDER BY created_at DESC, id DESC LIMIT 10 OFFSET 0;
CREATE INDEX tx_user_created_id ON tx (user_id, created_at DESC, id DESC);
CREATE INDEX tx_status_created_id ON tx (paypal_status, created_at DESC, id DESC);
DROP INDEX tx_user_id;
ANALYZE tx;
\echo === AFTER: first page, customer 1 (offset 0)
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SUMMARY ON) SELECT * FROM tx WHERE user_id = 1 ORDER BY created_at DESC, id DESC LIMIT 10 OFFSET 0;
\echo === AFTER: page 2500 by offset
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SUMMARY ON) SELECT * FROM tx WHERE user_id = 1 ORDER BY created_at DESC, id DESC LIMIT 10 OFFSET 24990;
\echo === AFTER: same depth by keyset
SELECT created_at AS c, id AS i FROM tx WHERE user_id = 1 ORDER BY created_at DESC, id DESC OFFSET 24989 LIMIT 1 \gset
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SUMMARY ON) SELECT * FROM tx WHERE user_id = 1 AND (created_at, id) < (:'c', :'i') ORDER BY created_at DESC, id DESC LIMIT 11;
\echo === AFTER: review queue first page
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SUMMARY ON) SELECT * FROM tx WHERE paypal_status IN ('HELD') ORDER BY created_at DESC, id DESC LIMIT 10 OFFSET 0;
\echo === sizes
SELECT pg_size_pretty(pg_relation_size('tx')) AS table, pg_size_pretty(pg_relation_size('tx_user_created_id')) AS user_idx, pg_size_pretty(pg_relation_size('tx_status_created_id')) AS status_idx;
