// js/utils/greekUtils.js

/**
 * Αφαιρεί τόνους από ελληνικά γράμματα.
 * Αν περαστεί κάτι που δεν είναι string, επιστρέφει κενό string.
 */
export function removeGreekDiacritics(text) {
  if (typeof text !== "string") return "";

  return text
    .normalize("NFD")                // διαχωρίζει γράμματα από διακριτικά
    .replace(/[\u0300-\u036f]/g, "") // αφαιρεί διακριτικά (τόνους)
    .replace(/[ς]/g, "σ")            // τελικό σίγμα → σ
    .trim();                         // καθάρισμα κενών
}
