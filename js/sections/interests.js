// js/sections/interests.js

export function initInterestsSection() {
  const interestsInput = document.getElementById("interests");
  if (!interestsInput) return;

  const details = interestsInput.closest("details");
  interestsInput.addEventListener("input", () => {
    if (details && !details.open) details.open = true;
  });
}
