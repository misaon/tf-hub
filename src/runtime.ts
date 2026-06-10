const entries = {
  k1: "dGYtZXJw",
  k2: "UFJPRFVDVElPTi1vcXQwbA==",
  k3: "QUl6YVN5QWs4YVJUZGFEaVdsY3JrN19ZX25OR05UUFZGMVA0UXhF",
  k4: "bG9naW4uZGlnaXRhbGJvb3N0Z3JvdXAuYXBw",
  k5: "aHR0cHM6Ly9hcGktZ3cuZGlnaXRhbGJvb3N0Z3JvdXAuYXBw",
  k6: "aHR0cHM6Ly90Zi1odWIuZGlnaXRhbGJvb3N0Z3JvdXAuYXBw",
  k7: "dGZwbC1pZC10b2tlbg==",
} as const;

export function read(key: keyof typeof entries): string {
  return atob(entries[key]);
}
