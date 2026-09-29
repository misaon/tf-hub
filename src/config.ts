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

export const firebaseSdkBaseUrl = "https://www.gstatic.com/firebasejs/12.19.0";
export const loginPageCdnScripts = [
  {
    src: "https://cdn.jsdelivr.net/npm/preact@10.29.8/dist/preact.umd.js",
    integrity: "sha384-sv9MUf3DTScOmi2+NOnSmwR2JpUeADK0KYAP8ohhmg99VOdSccabVgt/PnPDXK0N",
  },
  {
    src: "https://cdn.jsdelivr.net/npm/preact@10.29.8/hooks/dist/hooks.umd.js",
    integrity: "sha384-5BuvBL8F0gboRla2VFizWuUXbA44J2dFYJZZGhPD7/8zlTbKMJAPtgIerv7vIpPw",
  },
  {
    src: "https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js",
    integrity: "sha384-toVdrLSMaw7Y55MowcKqkmFL/Ek6Sky62NOk0b5sDDZBu2wcoPyyQUt9unDVjXhL",
  },
  {
    src: "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.3/dist/index.global.js",
    integrity: "sha384-2ql948lIdLcGEE0/qxNiudyTjgauA3RDJERu5xW75kFCvSl5a9odyQYCb6tEjnmB",
  },
];
