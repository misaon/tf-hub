import { read } from "./runtime.ts";

// Public config — client-side identifiers, safe to ship.
export const firebaseProjectId = read("k1");
export const firebaseTenantId = read("k2");
export const firebasePublicApiKey = read("k3");
export const firebaseAuthDomain = read("k4");

export const apiBaseUrl = read("k5");
export const webApplicationOrigin = read("k6");
export const idTokenHeaderName = read("k7");

export const secureTokenEndpoint = "https://securetoken.googleapis.com/v1/token";

export const repositoryUrl = "https://github.com/misaon/tf-hub";

export const maxRecordsPerPage = 999;

export const apiRequestTimeoutMs = 30_000;

export const appLocale = "cs";

export const firebaseSdkBaseUrl = "https://www.gstatic.com/firebasejs/12.14.0";
export const loginPageCdnScripts = [
  {
    src: "https://cdn.jsdelivr.net/npm/preact@10.29.2/dist/preact.umd.js",
    integrity: "sha384-SK4HFlogGmgu2v4SrKGT9KyVqE6klr5LytruwBsuX1ziFSmpvtdMtGhRhwPCZB/v",
  },
  {
    src: "https://cdn.jsdelivr.net/npm/preact@10.29.2/hooks/dist/hooks.umd.js",
    integrity: "sha384-SmlLD1N5/8XzQOVGl+3vXFWFItiof7iyUGdpNWr2QsVpmels7h9++PAQjNWhpQuA",
  },
  {
    src: "https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js",
    integrity: "sha384-toVdrLSMaw7Y55MowcKqkmFL/Ek6Sky62NOk0b5sDDZBu2wcoPyyQUt9unDVjXhL",
  },
  {
    src: "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.0/dist/index.global.js",
    integrity: "sha384-nWTzRTCY/9V4Bo352ehygr1c4cnst4XN6lMR3fipakEQrhVpc0hEM5Dii3Amz0sT",
  },
];
