// js/utils/greekUtils.js

/**
 * Αφαιρεί τόνους από ελληνικά γράμματα.
 * Αν περαστεί κάτι που δεν είναι string, επιστρέφει κενό string.
 */
export function toLatin(text) {
  if (typeof text !== "string") return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // αφαιρεί διακριτικά
    .replace(/ς/g, "σ")              // τελικό σίγμα
    .trim();
}
