// js/sections/biography.js

export function initBioSection() {
  // βασικά βιογραφικά: τόπος γέννησης, επάγγελμα, εκπαίδευση
  const inputs = [
    document.getElementById("birth_place"),
    document.getElementById("profession"),
    document.getElementById("education"),
  ].filter(Boolean);

  // αν δεν υπάρχει κανένα, δεν κάνουμε τίποτα
  if (!inputs.length) return;

  // το κοντινότερο details
  const details = inputs[0].closest("details");

  inputs.forEach(inp => {
    inp.addEventListener("input", () => {
      if (details && !details.open) details.open = true;
    });
  });
}
