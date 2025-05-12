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
  const month = String(d.getMonth() + 1).padStart(2, "0");
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
  // Φόρτωση από Supabase
  const { data, error } = await supabase
    .from("memorials")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) {
    document.body.innerHTML = `<p style="text-align:center;">❌ Δεν βρέθηκε η σελίδα μνήμης.</p>`;
    return;
  }

  // ─── Βασικά ─────────────────────────────────
  document.getElementById("fullName").textContent =
    `${data.first_name} ${data.last_name}`;
  const locText = `${data.city}, ${data.region}`;
  document.getElementById("location").textContent = locText;
  document.getElementById("photo").src        = data.photo_url || "";
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
    document.getElementById("dates").innerHTML = "";
  }
  updateCandleText(data.candles || 0);

  // ─── Extra Sections (εμφάνιση μόνο αν υπάρχει τιμή) ───
  // 1) Bio Section
  if (data.birth_place || data.profession || data.education) {
    document.getElementById("bioSection").style.display = "block";
    if (data.birth_place) {
      document.getElementById("birthPlace").textContent = data.birth_place;
      document.getElementById("birthPlaceLine").style.display = "block";
    }
    if (data.profession) {
      document.getElementById("profession").textContent = data.profession;
      document.getElementById("professionLine").style.display = "block";
    }
    if (data.education) {
      document.getElementById("education").textContent = data.education;
      document.getElementById("educationLine").style.display = "block";
    }
  }

  // 2) Awards
  if (data.awards) {
    document.getElementById("awardsSection").style.display = "block";
    document.getElementById("awards").textContent = data.awards;
  }

  // 3) Interests
  if (data.interests) {
    document.getElementById("interestsSection").style.display = "block";
    document.getElementById("interests").textContent = data.interests;
  }

  // 4) Burial
  if (data.cemetery) {
    document.getElementById("burialSection").style.display = "block";
    document.getElementById("cemetery").textContent = data.cemetery;
  }

  // ─── Render Γενεαλογικές Σχέσεις ───────────────────
  // Εξασφαλίζουμε ότι ο πίνακας υπάρχει
  const relTbody = document.querySelector("#relationshipsTable tbody");
  if (relTbody) {
    // Φόρτωση σχέσεων
    const { data: relRows, error: relErr } = await supabase
      .from("relationships")
      .select("*")
      .eq("memorial_id", id);
    if (relErr) {
      console.error("Error loading relationships:", relErr);
    } else {
      // Αφαιρούμε placeholder row
      const placeholder = document.getElementById("noRelationshipsRow");
      if (relRows.length > 0 && placeholder) placeholder.remove();

      // Για κάθε σχέση, βγάζουμε το όνομα από memorials
      for (const r of relRows) {
        const { data: person, error: pErr } = await supabase
          .from("memorials")
          .select("first_name, last_name")
          .eq("id", r.relative_id)
          .single();
        if (pErr || !person) {
          console.warn("Failed to load relative info for", r.relative_id, pErr);
          continue;
        }
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="padding:8px;">${person.first_name} ${person.last_name}</td>
          <td style="padding:8px;">${r.relation_type}</td>
        `;
        relTbody.appendChild(tr);
      }
    }
  }

  // ─── Slide-down χάρτης ────────────────────────
  const openBtn  = document.getElementById("openMapBtn");
  const closeBtn = document.getElementById("closeMapBtn");
  const mapCont  = document.getElementById("mapContainer");
  let leafletMap = null;

  openBtn.addEventListener("click", async () => {
    if (!leafletMap) {
      const res    = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locText)}`
      );
      const places = await res.json();
      if (!places[0]) {
        return alert("Δεν βρέθηκε η τοποθεσία στο χάρτη.");
      }
      const lat = parseFloat(places[0].lat),
            lon = parseFloat(places[0].lon);
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
    document.querySelector(".memorial-container")
      .scrollIntoView({ behavior: "smooth" });
  });
  // ───────────────────────────────────────────────

})(); // <-- τέλος async IIFE

// ─── Toggle Βιογραφικού ─────────────────────────
const bioBtn  = document.getElementById("toggleBioBtn");
const bioCont = document.getElementById("bioContainer");

if (bioBtn && bioCont) {
  bioBtn.addEventListener("click", () => {
    bioCont.classList.toggle("open");
    bioBtn.textContent = bioCont.classList.contains("open")
      ? "✖️ Κλείσε Βιογραφικό"
      : "📖 Βιογραφικό";
  });
}
// ────────────────────────────────────────────────

// 🕯️ Άναψε κερί
document.getElementById("lightCandleBtn")
  .addEventListener("click", async () => {
    const key = `lastCandle_${id}`;
    const last = localStorage.getItem(key);
    const now  = Date.now();
    if (last && now - parseInt(last) < 24 * 60 * 60 * 1000) {
      return alert("Μπορείς να ανάψεις μόνο 1 κερί το 24ωρο");
    }
    const { data: newCount, error: candleErr } = await supabase
      .rpc("increment_candle", { memorial_id: id });
    if (candleErr || newCount === null) {
      alert("❌ Το κερί δεν καταγράφηκε. Δοκίμασε ξανά.");
      console.error(candleErr);
      return;
    }
    localStorage.setItem(key, now.toString());
    updateCandleText(newCount);
  });
