// js/view.js
import { supabase } from "./supabase.js";

// 👉 Λήψη ID από URL
const params = new URLSearchParams(location.search);
const id = params.get("id");
if (!id) {
  document.body.innerHTML = `<p style="text-align:center;">❌ Δεν υπάρχει memorial ID</p>`;
  throw new Error("Missing ID");
}

// 👉 Format ημερομηνίας σε DD-MM-YYYY
function formatDate(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth()+1).padStart(2, "0");
  const year  = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// 👉 Υπολογισμός ηλικίας
function calculateAge(birth, death) {
  if (!birth || !death) return null;
  const b = new Date(birth), D = new Date(death);
  let age = D.getFullYear() - b.getFullYear();
  const m = D.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && D.getDate() < b.getDate())) age--;
  return age;
}

// 👉 Ενημέρωση κειμένου κεριών
function updateCandleText(count) {
  const txt = count === 1
    ? "🕯️ 1 κερί έχει ανάψει"
    : `🕯️ ${count} κεριά έχουν ανάψει`;
  document.getElementById("candleText").textContent = txt;
}

(async () => {
  // Φόρτωση απ’ το Supabase
  const { data, error } = await supabase
    .from("memorials")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) {
    document.body.innerHTML = `<p style="text-align:center;">❌ Δεν βρέθηκε η σελίδα μνήμης.</p>`;
    return;
  }

  // ─── Βασικά ─────────────────────────────────────────
  document.getElementById("fullName").textContent = `${data.first_name} ${data.last_name}`;
  const locText = `${data.city}${data.region ? ", " + data.region : ""}`;
  document.getElementById("location").textContent = locText;
  document.getElementById("photo").src         = data.photo_url || "";
  document.getElementById("message").textContent = data.message || "";

  // YouTube embed
  if (data.youtube_url) {
    const container = document.getElementById("videoContainer");
    const embedUrl  = data.youtube_url.replace("watch?v=", "embed/");
    container.innerHTML = 
      `<iframe width="100%" height="315" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;
  }

  // Ημερομηνίες & ηλικία
  const bStr = formatDate(data.birth_date);
  const dStr = formatDate(data.death_date);
  const age  = calculateAge(data.birth_date, data.death_date);
  if (bStr && dStr) {
    document.getElementById("dates").innerHTML = `
      <p>Έζησε από</p>
      <p><strong>${bStr}</strong> μέχρι <strong>${dStr}</strong></p>
      <p>Απεβίωσε σε ηλικία <strong>${age}</strong> ετών</p>
    `;
  } else {
    document.getElementById("dates").textContent = "";
  }
  updateCandleText(data.candles || 0);

  // ─── Extra sections (εμφάνιση μόνο αν υπάρχει περιεχόμενο) ──
  const extras = [
    { field: "birth_place",    section: "birthPlaceSection",    element: "birthPlace" },
    { field: "profession",     section: "professionSection",    element: "profession" },
    { field: "education",      section: "educationSection",     element: "education" },
    { field: "awards",         section: "awardsSection",        element: "awardsText" },
    { field: "interests",      section: "interestsSection",     element: "interestsText" },
    { field: "cemetery",       section: "cemeterySection",      element: "cemetery" },
    { field: "genealogy",      section: "genealogySection",     element: "genealogy" }
  ];
  extras.forEach(({ field, section, element }) => {
    if (data[field]) {
      const sec = document.getElementById(section);
      const el  = document.getElementById(element);
      if (sec && el) {
        el.textContent = data[field];
        sec.style.display = "block";
      }
    }
  });

  // ─── Slide-down map setup ───────────────────────────
  const openBtn  = document.getElementById("openMapBtn");
  const closeBtn = document.getElementById("closeMapBtn");
  const mapCont  = document.getElementById("mapContainer");
  let leafletMap = null;

  openBtn.addEventListener("click", async () => {
    if (!leafletMap) {
      // geocode με Nominatim
      const resp   = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locText)}`);
      const places = await resp.json();
      if (!places[0]) {
        return alert("Δεν βρέθηκε η τοποθεσία στο χάρτη.");
      }
      const lat = parseFloat(places[0].lat),
            lon = parseFloat(places[0].lon);
      // init Leaflet
      leafletMap = L.map("map").setView([lat, lon], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
      }).addTo(leafletMap);
      L.marker([lat, lon]).addTo(leafletMap);
    }
    mapCont.classList.add("open");
    mapCont.scrollIntoView({ behavior: "smooth" });
  });

  closeBtn.addEventListener("click", () => {
    mapCont.classList.remove("open");
    document.querySelector(".memorial-container").scrollIntoView({ behavior: "smooth" });
  });
  // ────────────────────────────────────────────────────

})();

// 🕯️ Άναψε κερί
document.getElementById("lightCandleBtn").addEventListener("click", async () => {
  const key  = `lastCandle_${id}`;
  const last = localStorage.getItem(key);
  const now  = Date.now();
  if (last && now - parseInt(last) < 24*60*60*1000) {
    return alert("Μπορείς να ανάψεις μόνο 1 κερί το 24ωρο");
  }
  const { data, error } = await supabase.rpc("increment_candle", { memorial_id: id });
  if (error || data === null) {
    alert("❌ Το κερί δεν καταγράφηκε. Δοκίμασε ξανά.");
    console.error(error);
    return;
  }
  localStorage.setItem(key, now.toString());
  updateCandleText(data);
});
