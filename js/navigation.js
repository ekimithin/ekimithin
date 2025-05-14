// js/navigation.js
document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("menuToggleBtn");
  const navLinks = document.getElementById("mainNav");

  if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", () => {
      navLinks.classList.toggle("open");
    });

    // Κλείσιμο με click εκτός
    document.addEventListener("click", (e) => {
      if (
        !menuBtn.contains(e.target) &&
        !navLinks.contains(e.target)
      ) {
        navLinks.classList.remove("open");
      }
    });
  }
});
