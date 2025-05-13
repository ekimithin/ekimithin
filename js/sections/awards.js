// js/sections/awards.js

export function initAwardsSection() {
  const awardsInput = document.getElementById("awards");
  if (!awardsInput) return;

  const details = awardsInput.closest("details");
  awardsInput.addEventListener("input", () => {
    if (details && !details.open) details.open = true;
  });
}
