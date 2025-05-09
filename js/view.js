// js/view.js
import { supabase } from "./supabase.js";

// 👉 Λήψη ID από URL
const params = new URLSearchParams(location.search);
const id = params.get("id");
if (!id) {
  document.body.innerHTML = "<p style='text-align:center;'>❌ Δεν υπάρχει memorial ID</p>";
  throw new Error("Missing ID");
}

// 👉 Format ημερομηνίας σε DD-MM-YYYY
function formatDate(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// 👉 Υπολογισμός ηλικίας
function calculateAge(birth, death) {
  if (!birth || !death) return null;
  const b = new Date(birth);
  const d = new Date(death);
  let age = d.getFullYear() - b.getFullYear();
  const m = d.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && d.getDate() < b.getDate())) age--;
  return age;
}

// 👉 Ενημέρωση κελιού με σωστή σύνταξη
function updateCandleText(count) {
  const text = count === 1
    ? "🕯️ 1 κερί έχει ανάψει"
    : `🕯️ ${count} κεριά έχουν ανάψει`;
  document.getElementById("candleText").textContent = text;
}

// 👉 Φόρτωσε memorial από Supabase και στήσε UI + map controls
(async () => {
  const { data, error } = await supabase
    .from("memorials")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    document.body.innerHTML = "<p style='text-align:center;'>❌ Δεν βρέθηκε η σελίδα μνήμης.</p>";
    return;
  }

  // Βασικά πεδία
  document.getElementById("fullName").textContent = `${data.first_name} ${data.last_name}`;
  const locText = `${data.city}, ${data.region}`;
  document.getElementById("location").textContent = locText;
  document.getElementById("photo").src = data.photo_url || "";
  document.getElementById("message").textContent = data.message || "";

  // YouTube embed
  if (data.youtube_url) {
    const videoContainer = document.getElementById("videoContainer");
    const embedUrl = data.youtube_url.replace("watch?v=", "embed/");
    videoContainer.innerHTML = `<iframe width="100%" height="315" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;
  }

  // Ημερομηνίες & ηλικία
  const birthStr = formatDate(data.birth_date);
  const deathStr = formatDate(data.death_date);
  const age      = calculateAge(data.birth_date, data.death_date);
  if (birthStr && deathStr) {
    document.getElementById("dates").innerHTML = `
      <p>Έζησε από</p>
      <p><strong>${birthStr}</strong> μέχρι <strong>${deathStr}</strong></p>
      <p>Απεβίωσε σε ηλικία <strong>${age}</strong> ετών</p>
    `;
  } else {
    document.getElementById("dates").innerHTML = "";
  }
  updateCandleText(data.candles || 0);

  // === Slide-down map setup ===
  // Στοιχεία DOM
  const openBtn     = document.getElementById("openMapBtn");
  const closeBtn    = document.getElementById("closeMapBtn");
  const mapCont     = document.getElementById("mapContainer");
  let   leafletMap; // θα κρατήσει το instance

  // Όταν πατάμε "Δες τοποθεσία"
  openBtn.addEventListener("click", async () => {
    // Αν δεν έχεις map, κάνε geocode με Nominatim
    if (!leafletMap) {
      const resp    = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locText)}`
      );
      const results = await resp.json();
      if (!results[0]) {
        return alert("Δεν βρέθηκε η τοποθεσία στο χάρτη.");
      }
      const lat = parseFloat(results[0].lat);
      const lon = parseFloat(results[0].lon);
      // Init Leaflet
      leafletMap = L.map("map").setView([lat, lon], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
      }).addTo(leafletMap);
      L.marker([lat, lon]).addTo(leafletMap);
    }
    // Άνοιξε container & scroll
    mapCont.classList.add("open");
    mapCont.scrollIntoView({ behavior: "smooth" });
  });

  // Όταν πατάμε "Κλείσιμο χάρτη"
  closeBtn.addEventListener("click", () => {
    mapCont.classList.remove("open");
    document.querySelector(".memorial-container").scrollIntoView({ behavior: "smooth" });
  });
  // === Τέλος map setup ===

})();

// 🕯️ Άναψε κερί
document.getElementById("lightCandleBtn").addEventListener("click", async () => {
  const lastLitKey = `lastCandle_${id}`;
  const lastLit    = localStorage.getItem(lastLitKey);
  const now        = Date.now();

  if (lastLit && now - parseInt(lastLit) < 24 * 60 * 60 * 1000) {
    alert("Μπορείς να ανάψεις μόνο 1 κερί το 24ωρο");
    return;
  }

  const { data, error } = await supabase.rpc("increment_candle", { memorial_id: id });
  if (error || data === null) {
    alert("❌ Το κερί δεν καταγράφηκε. Δοκίμασε ξανά.");
    console.error(error);
    return;
  }

  localStorage.setItem(lastLitKey, now.toString());
  updateCandleText(data);
});
