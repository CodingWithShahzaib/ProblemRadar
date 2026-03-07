import dns from "node:dns/promises";
import net from "node:net";

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    return true;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fe80:")) return true; // link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
  return false;
}

function isPrivateIp(ip: string) {
  const kind = net.isIP(ip);
  if (kind === 4) return isPrivateIpv4(ip);
  if (kind === 6) return isPrivateIpv6(ip);
  return true;
}

export async function assertSafeHttpUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http/https URLs are supported.");
  }

  if (url.username || url.password) {
    throw new Error("URLs with credentials are not supported.");
  }

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("Localhost URLs are not allowed.");
  }

  // If the host is already an IP, block private ranges.
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Private network URLs are not allowed.");
    return url;
  }

  // Resolve DNS and block private targets (basic SSRF protection).
  const [v4, v6] = await Promise.allSettled([dns.resolve4(host), dns.resolve6(host)]);
  const ips = [
    ...(v4.status === "fulfilled" ? v4.value : []),
    ...(v6.status === "fulfilled" ? v6.value : []),
  ];

  if (ips.length === 0) throw new Error("Could not resolve hostname.");
  if (ips.some(isPrivateIp)) throw new Error("Private network URLs are not allowed.");

  return url;
}

