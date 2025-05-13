// js/sections/awards.js
export function initAwardsSection() {
  const awards = document.getElementById('awards');
  // π.χ. μπορείς να κάνεις live counter χαρακτήρων:
  awards.addEventListener('input', () => {
    // console.log(`Awards length: ${awards.value.length}`);
  });
}
