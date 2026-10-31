// Load test for the Sentrix API, run against a LOCAL stack only (see docs/performance.md and backend/loadtest/run.sh).
// Never point this at the deployed service, Neon or the PayPal sandbox: payments here use the simulated PayPal client.
//
//   WORKLOAD=scoring|lists|staff|limits   which traffic to send
//   RATES=2,5,10,20                       requests per second, one 30 s step each (not used by limits)
//   BASE_URL=http://api:3000   USERS=40   STEP=30
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const BASE = __ENV.BASE_URL || "http://localhost:3000";
const WORKLOAD = __ENV.WORKLOAD || "scoring";
const USERS = Number(__ENV.USERS || 40);
const STEP = Number(__ENV.STEP || 30);
const RATES = (__ENV.RATES || "2,5,10,20").split(",").map(Number);
const SESSION_COOKIE = "_fintech_backend_session";

const limited = new Counter("limited_429");
const wellFormed429 = new Counter("well_formed_429");
const serverErrors = new Counter("server_errors_5xx");

function scenarios() {
  if (WORKLOAD === "limits") {
    return { limits: { executor: "shared-iterations", vus: 1, iterations: 1, maxDuration: "3m", exec: "limits" } };
  }
  const out = {};
  RATES.forEach((rate, i) => {
    out[`r${rate}`] = {
      executor: "constant-arrival-rate",
      rate,
      timeUnit: "1s",
      duration: `${STEP}s`,
      preAllocatedVUs: Math.max(10, rate),
      maxVUs: Math.max(200, rate * 3),
      startTime: `${i * (STEP + 5)}s`,
      exec: WORKLOAD,
    };
  });
  return out;
}

// Empty thresholds make k6 print a sub-metric per step in the summary.
function thresholds() {
  const out = { server_errors_5xx: ["count>=0"] };
  if (WORKLOAD === "limits") return out;
  RATES.forEach((rate) => {
    out[`http_req_duration{scenario:r${rate}}`] = ["max>=0"];
    out[`http_req_failed{scenario:r${rate}}`] = ["rate>=0"];
    out[`http_reqs{scenario:r${rate}}`] = ["count>=0"];
  });
  return out;
}

export const options = {
  scenarios: scenarios(),
  thresholds: thresholds(),
  setupTimeout: "10m", // logins are bcrypt: slow on a tenth of a CPU
  summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max"],
  insecureSkipTLSVerify: true,
};

// Sessions are made once, before the timed steps (a login is a password hash, which would otherwise be most of the
// first seconds of every step). A session is sent as a header because the cookie is Secure and the test uses plain HTTP.
function login(email) {
  const res = http.post(`${BASE}/api/v1/auth/login`, { email, password: "password123" }, { tags: { name: "login" } });
  const cookie = res.cookies[SESSION_COOKIE];
  if (res.status !== 200 || !cookie) throw new Error(`login failed for ${email}: ${res.status}`);
  return { Cookie: `${SESSION_COOKIE}=${cookie[0].value}` };
}

export function setup() {
  if (WORKLOAD === "limits") return {};
  if (WORKLOAD === "staff") return { staff: login("judge.reviewer@sentrix.demo") };
  const customers = [];
  for (let i = 1; i <= USERS; i++) {
    customers.push(login(`load${i}@loadtest.test`));
    sleep(0.1);
  }
  return { customers };
}

function customer(data) {
  return data.customers[(__VU - 1) % USERS];
}

function track(res) {
  if (res.status === 429) {
    limited.add(1);
    const ok = res.headers["Retry-After"] && res.json("error") === "rate_limited";
    if (ok) wellFormed429.add(1);
  }
  if (res.status >= 500) serverErrors.add(1);
}

function get(path, name, headers) {
  const res = http.get(`${BASE}${path}`, { headers, tags: { name } });
  track(res);
  check(res, { [`${name} 200`]: (r) => r.status === 200 });
  return res;
}

// Scoring path: the real pipeline (rules, risk model, limits, capture or hold or void) with PayPal simulated and the
// AI analyst off (no key in the local stack), so the number is Sentrix's own work.
export function scoring(data) {
  const headers = customer(data);
  const amount = (5 + Math.floor(Math.random() * 400)).toString();
  const res = http.post(`${BASE}/api/v1/payments/simulate`, { amount, device_id: `device-${__VU}` }, { headers, tags: { name: "simulate" } });
  track(res);
  check(res, { "simulate 201": (r) => r.status === 201 });
}

// What the pages read: Home, the payments list (keyset first page), My Spending, deep health.
export function lists(data) {
  const headers = customer(data);
  const pick = Math.random();
  if (pick < 0.3) get("/api/v1/home", "home", headers);
  else if (pick < 0.7) get("/api/v1/transactions?cursor=&per_page=10", "transactions", headers);
  else if (pick < 0.9) get("/api/v1/spending?period=30d", "spending", headers);
  else get("/api/v1/health/deep", "health_deep");
}

// What staff read: the review queue (keyset), Insights (cached 60 s), Feedback, Home.
export function staff(data) {
  const headers = data.staff;
  const pick = Math.random();
  if (pick < 0.35) get("/api/v1/admin/review_queue?cursor=&per_page=10", "review_queue", headers);
  else if (pick < 0.65) get("/api/v1/admin/insights?period=7d", "insights", headers);
  else if (pick < 0.85) get("/api/v1/admin/feedback", "feedback", headers);
  else get("/api/v1/home", "home", headers);
}

// What the shipped limits do under a burst from one address: a flood of reads, a password guess run and a scoring
// burst by one customer. Counts how many were answered, how many were refused with a 429, whether each 429 carries
// Retry-After and the JSON error, and that nothing answered 5xx.
export function limits() {
  // 1. One customer scoring 30 payments back to back (limit: 20 a minute per person).
  const headers = login("load1@loadtest.test");
  let scored = 0;
  let scoringRefused = 0;
  for (let i = 0; i < 30; i++) {
    const res = http.post(`${BASE}/api/v1/payments/simulate`, { amount: "25", device_id: "device-limits" }, { headers, tags: { name: "simulate_burst" } });
    track(res);
    if (res.status === 201) scored++;
    else if (res.status === 429) scoringRefused++;
  }
  console.log(`scoring_burst scored=${scored} refused=${scoringRefused} of 30`);

  // 2. A password guessing run of 30 attempts from one address (limit: 20 a minute per address).
  let loginAnswered = 0;
  let loginRefused = 0;
  for (let i = 0; i < 30; i++) {
    const res = http.post(`${BASE}/api/v1/auth/login`, { email: `guess${i}@loadtest.test`, password: "wrong" }, { tags: { name: "login_guess" } });
    track(res);
    if (res.status === 401) loginAnswered++;
    else if (res.status === 429) loginRefused++;
  }
  console.log(`login_guess answered=${loginAnswered} refused=${loginRefused} of 30`);

  // 3. A flood of reads from one address for 20 s (limit: 600 requests per 5 minutes per address).
  let allowed = 0;
  let refused = 0;
  const start = Date.now();
  while (Date.now() - start < 20000) {
    const res = http.get(`${BASE}/api/v1/health`, { tags: { name: "burst_health" } });
    track(res);
    if (res.status === 200) allowed++;
    else if (res.status === 429) refused++;
  }
  console.log(`read_flood answered=${allowed} refused=${refused} in 20s`);
  sleep(1);
}
