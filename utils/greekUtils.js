// js/utils/greekUtils.js

/**
 * Αφαίρεση τόνων από ελληνικά γράμματα για χρήση σε αναζητήσεις.
 * π.χ. "Καραγιώργης" => "Καραγιωργης"
 */
export function removeGreekDiacritics(text) {
  return text
    .normalize("NFD") // διαχωρίζει γράμμα και τόνο
    .replace(/[\u0300-\u036f]/g, "") // αφαιρεί διακριτικά (τόνους)
    .replace(/[ς]/g, "σ"); // αντιμετώπιση τελικού σίγμα
}
