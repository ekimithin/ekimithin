// js/utils/greekUtils.js

// ✅ Αφαιρεί διακριτικά και κάνει λατινοποίηση
export function toLatin(text) {
  if (typeof text !== "string") return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // αφαιρεί διακριτικά (τόνους)
    .replace(/ς/g, "σ")              // τελικό σίγμα
    .trim();
}

// ✅ Μόνο αφαίρεση διακριτικών (χωρίς s -> σ)
export function removeGreekDiacritics(text) {
  if (typeof text !== "string") return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // αφαιρεί διακριτικά
    .trim();
}
