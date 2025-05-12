// js/view.js

/**
 * Module: view.js
 * Διαχειρίζεται την εμφάνιση μιας σελίδας μνήμης:
 * - Λήψη ID από το URL
 * - Φόρτωση δεδομένων από Supabase
 * - Εμφάνιση βασικών πληροφοριών (όνομα, ημερομηνίες, ηλικία, μήνυμα, φωτογραφία, βίντεο)
 * - Εμφάνιση επιπλέον sections (βιογραφικό, διακρίσεις, ενδιαφέροντα, ταφή)
 * - Φόρτωση και εμφάνιση γενεαλογικών σχέσεων
 * - Slide-down χάρτης με OpenStreetMap/Nominatim
 * - Toggle βιογραφικού
 * - “Άναμμα” κεριού με RPC Supabase
 */

console.debug("[MODULE LOAD]", { module: "view.js" });

import { supabase } from "./supabase.js";

// ─── 1. Λήψη ID από το URL ─────────────────────────────
console.debug("[ACTION]", "parse URL for id");
const params = new URLSearchParams(location.search);
const id = params.get("id");
if (!id) {
  console.warn("[MISSING PARAM]", "No memorial ID in URL");
  document.body.innerHTML = `<p style="text-align:center;">❌ Δεν υπάρχει memorial ID</p>`;
  throw new Error("Missing ID");
}
console.debug("[PARAM]", { id });

// ─── 2. Utility Functions ──────────────────────────────
// Format ISO string σε DD-MM-YYYY
function formatDate(isoString) {
  console.debug("[FUNCTION CALL]", "formatDate", { isoString });
  if (!isoString) {
    console.warn("[FORMAT WARNING]", "No date provided");
    return null;
  }
  const d = new Date(isoString);
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year  = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// Υπολογισμός ηλικίας από γεννηση-θάνατο
function calculateAge(birth, death) {
  console.debug("[FUNCTION CALL]", "calculateAge", { birth, death });
  if (!birth || !death) {
    console.warn("[CALC WARNING]", "Missing birth or death date");
    return null;
  }
  const b = new Date(birth), D = new Date(death);
  let age = D.getFullYear() - b.getFullYear();
  const m = D.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && D.getDate() < b.getDate())) age--;
  return age;
}

// Ενημέρωση κειμένου κεριών
function updateCandleText(count) {
  console.debug("[FUNCTION CALL]", "updateCandleText", { count });
  const txt = count === 1
    ? "🕯️ 1 κερί έχει ανάψει"
    : `🕯️ ${count} κεριά έχουν ανάψει`;
  const el = document.getElementById("candleText");
  if (!el) {
    console.warn("[DOM MISSING]", "candleText");
    return;
  }
  el.textContent = txt;
  console.debug("[DOM UPDATE]", { selector: "#candleText", text: txt });
}

// ─── 3. Φόρτωση δεδομένων memorial ─────────────────────
(async () => {
  console.debug("[API CALL START]", { query: "fetch memorial", id });
  const { data, error } = await supabase
    .from("memorials")
    .select("*")
    .eq("id", id)
    .single();
  console.debug("[API CALL RESULT]", { data, error });
  if (error || !data) {
    console.error("[API ERROR]", error || "No data");
    document.body.innerHTML = `<p style="text-align:center;">❌ Δεν βρέθηκε η σελίδα μνήμης.</p>`;
    return;
  }

  // ─── 3.1 Βασικά στοιχεία ────────────────────────────
  console.debug("[DOM UPDATE]", "populate basic fields");
  document.getElementById("fullName").textContent =
    `${data.first_name} ${data.last_name}`;
  console.debug("[DOM UPDATE]", { selector: "#fullName", text: data.first_name + " " + data.last_name });

  const locText = `${data.city}, ${data.region}`;
  const locEl = document.getElementById("location");
  locEl.textContent = locText;
  console.debug("[DOM UPDATE]", { selector: "#location", text: locText });

  document.getElementById("photo").src = data.photo_url || "";
  console.debug("[DOM UPDATE]", { selector: "#photo", src: data.photo_url });

  document.getElementById("message").textContent = data.message || "";
  console.debug("[DOM UPDATE]", { selector: "#message", text: data.message });

  // YouTube embed
  if (data.youtube_url) {
    console.debug("[ACTION]", "embed YouTube video", data.youtube_url);
    const container = document.getElementById("videoContainer");
    const embedUrl  = data.youtube_url.replace("watch?v=", "embed/");
    container.innerHTML =
      `<iframe width="100%" height="315" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;
    console.debug("[DOM UPDATE]", { selector: "#videoContainer", html: "iframe added" });
  }

  // ─── 3.2 Ημερομηνίες & ηλικία ────────────────────────
  const bStr = formatDate(data.birth_date);
  const dStr = formatDate(data.death_date);
  const age  = calculateAge(data.birth_date, data.death_date);
  const datesEl = document.getElementById("dates");
  if (bStr && dStr) {
    datesEl.innerHTML = `
      <p>Έζησε από</p>
      <p><strong>${bStr}</strong> μέχρι <strong>${dStr}</strong></p>
      <p>Απεβίωσε σε ηλικία <strong>${age}</strong> ετών</p>
    `;
    console.debug("[DOM UPDATE]", { selector: "#dates", html: datesEl.innerHTML });
  } else {
    datesEl.innerHTML = "";
    console.debug("[DOM UPDATE]", { selector: "#dates", html: "cleared" });
  }
  updateCandleText(data.candles || 0);

  // ─── 4. Extra Sections ──────────────────────────────
  // 4.1 Bio Section
  if (data.birth_place || data.profession || data.education) {
    console.debug("[SECTION]", "show bio");
    document.getElementById("bioSection").style.display = "block";
    if (data.birth_place) {
      document.getElementById("birthPlace").textContent = data.birth_place;
      document.getElementById("birthPlaceLine").style.display = "block";
      console.debug("[DOM UPDATE]", { selector: "#birthPlaceLine", text: data.birth_place });
    }
    if (data.profession) {
      document.getElementById("profession").textContent = data.profession;
      document.getElementById("professionLine").style.display = "block";
      console.debug("[DOM UPDATE]", { selector: "#professionLine", text: data.profession });
    }
    if (data.education) {
      document.getElementById("education").textContent = data.education;
      document.getElementById("educationLine").style.display = "block";
      console.debug("[DOM UPDATE]", { selector: "#educationLine", text: data.education });
    }
  }

  // 4.2 Awards
  if (data.awards) {
    console.debug("[SECTION]", "show awards");
    document.getElementById("awardsSection").style.display = "block";
    document.getElementById("awards").textContent = data.awards;
    console.debug("[DOM UPDATE]", { selector: "#awardsSection", text: data.awards });
  }

  // 4.3 Interests
  if (data.interests) {
    console.debug("[SECTION]", "show interests");
    document.getElementById("interestsSection").style.display = "block";
    document.getElementById("interests").textContent = data.interests;
    console.debug("[DOM UPDATE]", { selector: "#interestsSection", text: data.interests });
  }

  // 4.4 Burial
  if (data.cemetery) {
    console.debug("[SECTION]", "show burial");
    document.getElementById("burialSection").style.display = "block";
    document.getElementById("cemetery").textContent = data.cemetery;
    console.debug("[DOM UPDATE]", { selector: "#burialSection", text: data.cemetery });
  }

  // ─── 5. Γενεαλογικές Σχέσεις ─────────────────────────
  console.debug("[ACTION]", "load relationships");
  const relTbody = document.querySelector("#relationshipsTable tbody");
  if (relTbody) {
    const { data: relRows, error: relErr } = await supabase
      .from("relationships")
      .select("*")
      .eq("memorial_id", id);
    console.debug("[API CALL RESULT]", { data: relRows, error: relErr });

    if (relErr) {
      console.error("[API ERROR]", relErr);
    } else {
      // Αφαίρεση placeholder
      const placeholder = document.getElementById("noRelationshipsRow");
      if (relRows.length > 0 && placeholder) {
        placeholder.remove();
        console.debug("[DOM UPDATE]", "removed placeholder row");
      }
      for (const r of relRows) {
        const { data: person, error: pErr } = await supabase
          .from("memorials")
          .select("first_name, last_name")
          .eq("id", r.relative_id)
          .single();
        console.debug("[API CALL RESULT]", { relative: r.relative_id, data: person, error: pErr });
        if (pErr || !person) {
          console.warn("[REL WARN]", `Could not load relative ${r.relative_id}`);
          continue;
        }
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="padding:8px;">${person.first_name} ${person.last_name}</td>
          <td style="padding:8px;">${r.relation_type}</td>
        `;
        relTbody.appendChild(tr);
        console.debug("[DOM UPDATE]", { selector: "#relationshipsTable tbody", action: "row appended" });
      }
    }
  } else {
    console.warn("[DOM MISSING]", "#relationshipsTable tbody");
  }

  // ─── 6. Slide-down χάρτης ────────────────────────────
  console.debug("[ACTION]", "setup map toggle");
  const openBtn  = document.getElementById("openMapBtn");
  const closeBtn = document.getElementById("closeMapBtn");
  const mapCont  = document.getElementById("mapContainer");
  let leafletMap = null;

  openBtn?.addEventListener("click", async () => {
    console.debug("[EVENT]", "click", { id: "openMapBtn" });
    if (!leafletMap) {
      console.debug("[API CALL START]", { query: "geocode location", params: locText });
      const res    = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locText)}`
      );
      const places = await res.json();
      console.debug("[API CALL RESULT]", { data: places });
      if (!places[0]) {
        console.warn("[GEOCODE WARN]", "No results for", locText);
        return alert("Δεν βρέθηκε η τοποθεσία στο χάρτη.");
      }
      const lat = parseFloat(places[0].lat), lon = parseFloat(places[0].lon);
      leafletMap = L.map("map").setView([lat, lon], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "&copy; OpenStreetMap"
      }).addTo(leafletMap);
      L.marker([lat, lon]).addTo(leafletMap);
      console.debug("[DOM UPDATE]", "initialized inline leaflet map");
    }
    mapCont.classList.add("open");
    console.debug("[DOM UPDATE]", { selector: "#mapContainer", action: "open" });
    mapCont.scrollIntoView({ behavior: "smooth" });
  });

  closeBtn?.addEventListener("click", () => {
    console.debug("[EVENT]", "click", { id: "closeMapBtn" });
    mapCont.classList.remove("open");
    console.debug("[DOM UPDATE]", { selector: "#mapContainer", action: "close" });
    document.querySelector(".memorial-container")
      ?.scrollIntoView({ behavior: "smooth" });
  });
})(); // τέλος async IIFE

// ─── 7. Toggle Βιογραφικού ───────────────────────────
console.debug("[ACTION]", "bind bio toggle");
const bioBtn  = document.getElementById("toggleBioBtn");
const bioCont = document.getElementById("bioContainer");
if (bioBtn && bioCont) {
  bioBtn.addEventListener("click", () => {
    console.debug("[EVENT]", "click", { id: "toggleBioBtn" });
    bioCont.classList.toggle("open");
    const text = bioCont.classList.contains("open") ? "✖️ Κλείσε Βιογραφικό" : "📖 Βιογραφικό";
    bioBtn.textContent = text;
    console.debug("[DOM UPDATE]", { selector: "#bioContainer", action: "toggle", open: bioCont.classList.contains("open") });
  });
} else {
  console.warn("[DOM MISSING]", "toggleBioBtn or bioContainer");
}

// ─── 8. “Άναψε Κερί” ──────────────────────────────────
console.debug("[ACTION]", "bind lightCandleBtn");
document.getElementById("lightCandleBtn")?.addEventListener("click", async () => {
  console.debug("[EVENT]", "click", { id: "lightCandleBtn" });
  const key = `lastCandle_${id}`;
  const last = localStorage.getItem(key);
  const now  = Date.now();
  if (last && now - parseInt(last) < 24 * 60 * 60 * 1000) {
    console.warn("[CANDLE LIMIT]", "once per 24h");
    return alert("Μπορείς να ανάψεις μόνο 1 κερί το 24ωρο");
  }
  console.debug("[API CALL START]", { query: "rpc increment_candle", params: { memorial_id: id } });
  const { data: newCount, error: candleErr } = await supabase
    .rpc("increment_candle", { memorial_id: id });
  console.debug("[API CALL RESULT]", { newCount, error: candleErr });
  if (candleErr || newCount == null) {
    console.error("[API ERROR]", candleErr);
    alert("❌ Το κερί δεν καταγράφηκε. Δοκίμασε ξανά.");
    return;
  }
  localStorage.setItem(key, now.toString());
  updateCandleText(newCount);
});
