import http from "k6/http";
import { check, group } from "k6";
import exec from "k6/execution";
import { Trend } from "k6/metrics";

const BASE_URL = (__ENV.API_BASE_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
const healthDuration = new Trend("http_req_duration_health", true);
const governanceDuration = new Trend("http_req_duration_governance", true);
const exerciseTypesDuration = new Trend("http_req_duration_exercise_types", true);
const translationsDuration = new Trend("http_req_duration_translations", true);

function clientHeaders() {
  // The backend deliberately rate-limits by client IP. CI runs behind one local
  // socket, so give each synthetic iteration an RFC 2544 benchmarking address.
  // TRUST_PROXY=true is enabled only for this isolated CI process.
  const id = Number(exec.scenario.iterationInTest) || 0;
  const third = Math.floor(id / 250) % 250;
  const fourth = (id % 250) + 1;
  return { "X-Forwarded-For": `198.18.${third}.${fourth}` };
}

export const options = {
  discardResponseBodies: true,
  scenarios: {
    sustain: {
      executor: "constant-arrival-rate",
      rate: 8,
      timeUnit: "1s",
      duration: "45s",
      preAllocatedVUs: 16,
      maxVUs: 64,
    },
    burst: {
      executor: "ramping-arrival-rate",
      startRate: 8,
      timeUnit: "1s",
      stages: [
        { target: 20, duration: "15s" },
        { target: 0, duration: "5s" },
      ],
      preAllocatedVUs: 24,
      maxVUs: 96,
      startTime: "45s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<300"],
    http_req_failed: ["rate<0.01"],
    http_req_duration_health: ["p(95)<200"],
    http_req_duration_governance: ["p(95)<250"],
    http_req_duration_exercise_types: ["p(95)<300"],
    http_req_duration_translations: ["p(95)<300"],
  },
};

export default function () {
  const params = { headers: clientHeaders() };

  group("health", () => {
    const response = http.get(`${BASE_URL}/health`, params);
    healthDuration.add(response.timings.duration);
    check(response, { "health responds 200": (res) => res.status === 200 });
  });

  group("governance", () => {
    const response = http.get(`${BASE_URL}/api/v1/system/read-only/status`, params);
    governanceDuration.add(response.timings.duration);
    check(response, { "governance status responds 200": (res) => res.status === 200 });
  });

  group("exercise-types", () => {
    const response = http.get(`${BASE_URL}/api/v1/exercise-types`, params);
    exerciseTypesDuration.add(response.timings.duration);
    check(response, { "exercise types respond 200": (res) => res.status === 200 });
  });

  group("translations", () => {
    const response = http.get(`${BASE_URL}/api/v1/translations/en`, params);
    translationsDuration.add(response.timings.duration);
    check(response, { "translations respond 200": (res) => res.status === 200 });
  });
}
