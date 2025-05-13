// js/sections/burial.js

export function initBurialSection() {
  const cemeteryInput = document.getElementById("cemetery");
  if (!cemeteryInput) return;

  const details = cemeteryInput.closest("details");
  cemeteryInput.addEventListener("input", () => {
    if (details && !details.open) details.open = true;
  });
}
