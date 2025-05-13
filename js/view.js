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
  const b = new Date(birth), d = new Date(death);
  let age = d.getFullYear() - b.getFullYear();
  const m = d.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && d.getDate() < b.getDate())) age--;
  return age;
}

// 👉 Ενημέρωση κερίων
function updateCandleText(count) {
  const txt = count === 1
    ? "🕯️ 1 κερί έχει ανάψει"
    : `🕯️ ${count} κεριά έχουν ανάψει`;
  document.getElementById("candleText").textContent = txt;
}

(async () => {
  // 🔄 Φόρτωση memorial από Supabase
  const { data, error } = await supabase
    .from("memorials")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    document.body.innerHTML = `<p style="text-align:center;">❌ Δεν βρέθηκε η σελίδα μνήμης.</p>`;
    return;
  }

  // ✅ Τίτλος σελίδας
  document.title = `Μνήμη του ${data.first_name} ${data.last_name}`;

  // ✅ Βασικά στοιχεία
  document.getElementById("fullName").textContent = `${data.first_name} ${data.last_name}`;
  const locText = `${data.city}, ${data.region}`;
  document.getElementById("location").textContent = locText;
  document.getElementById("photo").src = data.photo_url || "";
  document.getElementById("message").textContent = data.message || "";

  // 🎞️ YouTube
  if (data.youtube_url) {
    const embedUrl = data.youtube_url.replace("watch?v=", "embed/");
    document.getElementById("videoContainer").innerHTML = `
      <iframe width="100%" height="315" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>
    `;
  }

  // 📅 Ημερομηνίες & ηλικία
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

  // ℹ️ Bio
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

  if (data.awards) {
    document.getElementById("awardsSection").style.display = "block";
    document.getElementById("awards").textContent = data.awards;
  }

  if (data.interests) {
    document.getElementById("interestsSection").style.display = "block";
    document.getElementById("interests").textContent = data.interests;
  }

  if (data.cemetery) {
    document.getElementById("burialSection").style.display = "block";
    document.getElementById("cemetery").textContent = data.cemetery;
  }

  if (data.genealogy) {
    document.getElementById("genealogySection").style.display = "block";
    document.getElementById("genealogy").textContent = data.genealogy;
  }

  // 🗺️ Χάρτης
  const openBtn = document.getElementById("openMapBtn");
  const closeBtn = document.getElementById("closeMapBtn");
  const mapCont = document.getElementById("mapContainer");
  let leafletMap = null;

  openBtn.addEventListener("click", async () => {
    if (!leafletMap) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locText)}`
        );
        const places = await res.json();
        if (!places[0]) throw new Error("Δεν βρέθηκε η τοποθεσία");

        const lat = parseFloat(places[0].lat);
        const lon = parseFloat(places[0].lon);

        leafletMap = L.map("map").setView([lat, lon], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap"
        }).addTo(leafletMap);
        L.marker([lat, lon]).addTo(leafletMap);
      } catch (e) {
        alert("⚠️ Δεν βρέθηκε η τοποθεσία στο χάρτη.");
        return;
      }
    }
    mapCont.classList.add("open");
    mapCont.scrollIntoView({ behavior: "smooth" });
  });

  closeBtn.addEventListener("click", () => {
    mapCont.classList.remove("open");
    document.querySelector(".memorial-container")
      .scrollIntoView({ behavior: "smooth" });
  });

})(); // τέλος async

// 🔄 Toggle Βιογραφικό
const bioBtn = document.getElementById("toggleBioBtn");
const bioCont = document.getElementById("bioContainer");

if (bioBtn && bioCont) {
  bioBtn.addEventListener("click", () => {
    bioCont.classList.toggle("open");
    bioBtn.textContent = bioCont.classList.contains("open")
      ? "✖️ Κλείσε Βιογραφικό"
      : "📖 Βιογραφικό";
  });
}

// 🕯️ Άναψε κερί
document.getElementById("lightCandleBtn")
  .addEventListener("click", async () => {
    const key = `lastCandle_${id}`;
    const last = localStorage.getItem(key);
    const now = Date.now();

    if (last && now - parseInt(last) < 24 * 60 * 60 * 1000) {
      return alert("Μπορείς να ανάψεις μόνο 1 κερί κάθε 24 ώρες.");
    }

    const { data, error } = await supabase.rpc("increment_candle", { memorial_id: id });
    if (error || data === null) {
      alert("❌ Το κερί δεν καταγράφηκε. Προσπάθησε ξανά.");
      console.error(error);
      return;
    }

    localStorage.setItem(key, now.toString());
    updateCandleText(data);
  });
