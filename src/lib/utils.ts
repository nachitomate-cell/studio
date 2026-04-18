import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validates an image URL for use in WebViews (e.g. Capacitor Android).
 * Returns the fallback if the URL is null, undefined, or uses an unsupported scheme.
 */
export function getSafeImageUrl(
  url: string | null | undefined,
  fallback = "/Logo2.png"
): string {
  if (!url) return fallback;
  if (url.startsWith("/") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return fallback;
}

// ─── Vendor visibility filter ────────────────────────────────────────────────

/**
 * Generic placeholder image paths assigned when a vendor has no uploaded photo.
 * Any vendor whose primary image is one of these is considered "not configured".
 */
const PLACEHOLDER_IMAGES = new Set([
  "/Logo3.png",
  "/Logo2.png",
  "/Logo.png",
  "",
]);

/**
 * Default names assigned automatically when a vendor profile is created
 * without a real business name. Case-insensitive comparison at call site.
 */
const PLACEHOLDER_NAMES = new Set([
  "local aliado",
  "new vendor",
  "sin nombre",
  "local del patio",
  "sin título",
  "sin titulo",
]);

/**
 * Returns true only if the vendor has both a real name and a real image.
 * Use this to filter public-facing lists (directory, search results, feeds).
 * Do NOT apply in admin/director panels — those must show all vendors.
 *
 * Checks:
 *   1. name  — not empty, not a known placeholder string
 *   2. image — imageUrl (or imagenTarjeta as fallback) is not a placeholder path
 */
export function isVendorVisible(vendor: {
  name: string;
  imageUrl: string;
  imagenTarjeta?: string;
}): boolean {
  // ── Name check ────────────────────────────────────────────────────────────
  const trimmedName = (vendor.name ?? "").trim();
  if (!trimmedName || PLACEHOLDER_NAMES.has(trimmedName.toLowerCase())) {
    return false;
  }

  // ── Image check ───────────────────────────────────────────────────────────
  // Accept if either the primary imageUrl OR the premium imagenTarjeta
  // is a non-placeholder value (so premium-only vendors aren't filtered out).
  const primaryOk =
    !!vendor.imageUrl && !PLACEHOLDER_IMAGES.has(vendor.imageUrl);
  const tarjetaOk =
    !!vendor.imagenTarjeta && !PLACEHOLDER_IMAGES.has(vendor.imagenTarjeta);

  return primaryOk || tarjetaOk;
}
