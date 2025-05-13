// js/admin.js

import { supabase } from "./supabase.js";
import { initBioSection } from "./sections/biography.js";
import { initAwardsSection } from "./sections/awards.js";
import { initInterestsSection } from "./sections/interests.js";
import { initBurialSection } from "./sections/burial.js";
import { removeGreekDiacritics } from "./utils/greekUtils.js";
import "./sections/relationships.js";

// 🔐 Redirect αν δεν είσαι συνδεδεμένος
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) window.location.href = "/login.html";
})();

// ================= DOM elements =================
const form        = document.getElementById("memorialForm");
const logoutBtn   = document.getElementById("logoutBtn");
const qrPreview   = document.getElementById("qr-preview");
const searchForm  = document.getElementById("searchForm");
const resultsDiv  = document.getElementById("resultsContainer");

// ================= Διεύθυνση autocomplete + Χάρτης =================
const addrIn   = document.getElementById("addressInput");
const suggList = document.getElementById("suggestions");
let addrTimer;

addrIn.addEventListener("input", () => {
  clearTimeout(addrTimer);
  const q = addrIn.value.trim();
  if (q.length < 3) { suggList.innerHTML = ""; return; }
  addrTimer = setTimeout(async () => {
    const res    = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
    const places = await res.json();
    suggList.innerHTML = places.slice(0,5).map(p =>
      `<li data-lat="${p.lat}" data-lon="${p.lon}">${p.display_name}</li>`
    ).join("");
  }, 300);
});

suggList.addEventListener("click", e => {
  if (e.target.tagName !== "LI") return;
  const { lat, lon } = e.target.dataset;
  const txt = e.target.textContent;
  const parts = txt.split(",");
  document.getElementById("region").value = parts[1]?.trim() || "";
  document.getElementById("city").value   = parts[0]?.trim() || "";
  map.setView([lat, lon], 14);
  marker.setLatLng([lat, lon]);
  addrIn.value = "";
  suggList.innerHTML = "";
});

// Leaflet χάρτης
const map    = L.map("map").setView([37.9838, 23.7275], 6);
const marker = L.marker([37.9838, 23.7275]).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

// ================= Διαγραφή Memorial =================
function attachDeleteListeners() {
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.replaceWith(btn.cloneNode(true)); // reset
  });
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!confirm("Θες σίγουρα να διαγράψεις αυτό το memorial;")) return;
      await supabase.storage.from("qr-codes").remove([`${id}.png`]);
      await supabase.from("relationships").delete().eq("memorial_id", id);
      const { error } = await supabase.from("memorials").delete().eq("id", id);
      if (error) return alert("❌ Σφάλμα διαγραφής.");
      btn.closest("div").remove();
      alert("✅ Διαγράφηκε memorial, σχέσεις & QR.");
    });
  });
}
// ================= Αναζήτηση memorials =================
searchForm.addEventListener("submit", async e => {
  e.preventDefault();
  const ln = document.getElementById("searchLastname").value.trim().toLowerCase();
  const ct = document.getElementById("searchCity").value.trim().toLowerCase();

  let q = supabase.from("memorials").select("*");
  if (ln && ct) q = q.ilike("last_name", ln).ilike("city", ct);
  else if (ln)  q = q.ilike("last_name", ln);
  else if (ct)  q = q.ilike("city", ct);

  const { data, error } = await q;
  resultsDiv.innerHTML = "";
  if (error || !data.length) {
    resultsDiv.innerHTML = "<p>❌ Δεν βρέθηκαν αποτελέσματα.</p>";
    return;
  }

  data.forEach(entry => {
    const div = document.createElement("div");
    div.style = "border:1px solid #ccc;padding:1rem;margin-bottom:1rem;border-radius:5px";
    div.innerHTML = `
      <strong>${entry.first_name} ${entry.last_name}</strong><br/>
      <small>${entry.city}, ${entry.region}</small><br/>
      <a href="/memorial.html?id=${entry.id}" target="_blank">➡️ Προβολή</a><br/>
      <button class="editBtn" data-id="${entry.id}">✏️ Επεξεργασία</button>
      <button class="deleteBtn" data-id="${entry.id}">🗑️ Διαγραφή</button>
    `;
    resultsDiv.appendChild(div);
  });

  attachDeleteListeners();

  document.querySelectorAll(".editBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const { data, error } = await supabase.from("memorials").select("*").eq("id", btn.dataset.id).single();
      if (error || !data) return alert("❌ Δεν βρέθηκε.");

      // ➕ Απόδοση ID στο form (για χρήση από relationships.js)
      form.dataset.id = data.id;

      // Φόρτωση πεδίων
      form.firstname.value   = data.first_name;
      form.lastname.value    = data.last_name;
      form.birth_date.value  = data.birth_date;
      form.death_date.value  = data.death_date;
      form.gender.value      = data.gender;
      form.region.value      = data.region;
      form.city.value        = data.city;
      form.message.value     = data.message;
      form.photoUrl.value    = data.photo_url;
      form.video.value       = data.youtube_url;

      form.birth_place.value = data.birth_place || "";
      form.profession.value  = data.profession  || "";
      form.education.value   = data.education   || "";
      form.awards.value      = data.awards      || "";
      form.interests.value   = data.interests   || "";
      form.cemetery.value    = data.cemetery    || "";
      form.genealogy.value   = data.genealogy   || "";

      // Σχέσεις
      const { data: rels } = await supabase.from("relationships").select("*").eq("memorial_id", data.id);
      const tbody = document.querySelector("#relationshipsTable tbody");
      tbody.innerHTML = "";
      rels.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${r.relation_type}</td>
          <td>${r.relative_id}</td>
          <td><button class="remove-relationship">✖️</button></td>
        `;
        tr.querySelector('.remove-relationship').addEventListener('click', () => tr.remove());
        tbody.appendChild(tr);
      });

      alert("✅ Memorial φορτώθηκε για επεξεργασία.");
    });
  });
});

// ================= Submit: καταχώρηση memorial =================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // 📌 Required fields
  const first = form.firstname.value.trim();
  const last  = form.lastname.value.trim();
  const city  = form.city.value.trim();
  if (!first || !last || !city) return alert("Συμπλήρωσε Όνομα, Επώνυμο, Πόλη.");

  const birth = form.birth_date.value || null;
  const death = form.death_date.value || null;

  // 📆 Ημερομηνίες ελέγχου
  if (birth && death && new Date(birth) > new Date(death)) return alert("Η γέννηση είναι μετά τον θάνατο.");
  if (!birth && death) return alert("❗ Έχεις θάνατο χωρίς γέννηση.");
  if (!death && birth) return alert("❗ Έχεις γέννηση χωρίς θάνατο.");

  // 🧠 Normalized strings
  const firstL = toLatin(first).toLowerCase();
  const lastL  = toLatin(last).toLowerCase();
  const initials = toLatin(first[0] + last[0]).toLowerCase();
  const timestamp = Date.now().toString().slice(-6);
  const slug = `${firstL}-${lastL}`;
  const id = `${initials}${timestamp}-${slug}`;

  console.log("🆔 Final ID:", id);

  // 👉 Απόδοση στο form dataset
  form.dataset.id = id;

  // 🔎 Συγκέντρωση δεδομένων
  const dataToSave = {
    id,
    first_name: first,
    last_name: lastL,
    city: toLatin(city).toLowerCase(),
    region: form.region.value.trim(),
    gender: form.gender.value,
    birth_date: birth,
    death_date: death,
    message: form.message.value.trim(),
    photo_url: form.photoUrl.value.trim(),
    youtube_url: form.video.value.trim(),
    birth_place: form.birth_place.value.trim(),
    profession: form.profession.value.trim(),
    education: form.education.value.trim(),
    awards: form.awards.value.trim(),
    interests: form.interests.value.trim(),
    cemetery: form.cemetery.value.trim(),
    genealogy: form.genealogy.value.trim(),
    created_at: new Date().toISOString(),
    candles: 0
  };

  // 📝 Αποθήκευση memorial
  const { error: upErr } = await supabase.from("memorials").upsert(dataToSave);
  if (upErr) {
    console.error("❌ Σφάλμα upsert:", upErr.message);
    return alert("❌ Δεν αποθηκεύτηκε το memorial.");
  }

  // 🔁 Αποθήκευση σχέσεων
const rels = Array.from(document.querySelectorAll("#relationshipsTable tbody tr"))
  .filter(tr => !tr.dataset.saved)
  .map(tr => {
    const relIdInput = tr.querySelector("input[name*='relative_id']");
    const relTypeInput = tr.querySelector("input[name*='relation']");
    return {
      memorial_id: id,
      relative_id: relIdInput ? relIdInput.value : tr.children[1]?.textContent.trim(),
      relation_type: relTypeInput ? relTypeInput.value : tr.children[0]?.textContent.trim()
    };
  });

if (rels.length > 0) {
  const { error: relErr } = await supabase.from("relationships").insert(rels);
  if (relErr) {
    console.error("❌ Σφάλμα σχέσεων:", relErr.message);
    alert("❌ Οι σχέσεις δεν αποθηκεύτηκαν.");
  }
}


  // 📦 Δημιουργία QR
  const url = `${location.origin}/memorial.html?id=${id}`;
  const blob = await (await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`)).blob();
  const fileName = `${id}.png`;

  const { error: qrErr } = await supabase.storage
    .from("qr-codes")
    .upload(fileName, blob, { contentType: "image/png", upsert: true });

  if (qrErr) {
    console.error("❌ Σφάλμα QR upload:", qrErr.message);
    return alert("❌ Το QR δεν αποθηκεύτηκε.");
  }

  const { data: qr } = supabase.storage.from("qr-codes").getPublicUrl(fileName);

  // ✅ Preview
  qrPreview.innerHTML = `
    <img src="${qr.publicUrl}" style="max-width:300px;margin-bottom:1rem;" />
    <div><a href="${url}" target="_blank">${url}</a></div>
    <a href="${qr.publicUrl}" download="${fileName}">⬇️ Κατέβασε το QR</a>
  `;

  alert("✅ Το memorial καταχωρήθηκε!");
  form.reset();
  form.removeAttribute("data-id");
  document.querySelector("#relationshipsTable tbody").innerHTML = "";
});



// ================= Logout =================
logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/login.html";
});

// ================= Init Section Modules =================
document.addEventListener("DOMContentLoaded", () => {
  initBioSection();
  initAwardsSection();
  initInterestsSection();
  initBurialSection();
});

// 🔄 Δημιουργία προσωρινού ID για νέες εγγραφές
["firstname", "lastname", "city"].forEach((field) => {
  document.getElementById(field).addEventListener("input", () => {
    const first = form.firstname.value.trim();
    const last  = form.lastname.value.trim();
    const city  = form.city.value.trim();

    if (!first || !last || !city) return;

    const tmp = `${toLatin(first[0] + last[0])}-${toLatin(city)}`.toLowerCase();
    form.dataset.id = `temp-${tmp}`;
  });
});

// ================= Helper: Greek to Latin =================
function toLatin(text) {
  const map = {
    'ά': 'a','έ': 'e','ή': 'i','ί': 'i','ό': 'o','ύ': 'y','ώ': 'o',
    'ς': 's','ϊ': 'i','ϋ': 'y','ΰ': 'y','ΐ': 'i',
    'α': 'a','β': 'b','γ': 'g','δ': 'd','ε': 'e','ζ': 'z','η': 'i','θ': 'th',
    'ι': 'i','κ': 'k','λ': 'l','μ': 'm','ν': 'n','ξ': 'x','ο': 'o','π': 'p',
    'ρ': 'r','σ': 's','τ': 't','υ': 'y','φ': 'f','χ': 'ch','ψ': 'ps','ω': 'o',
    'Α': 'A','Β': 'B','Γ': 'G','Δ': 'D','Ε': 'E','Ζ': 'Z','Η': 'I','Θ': 'Th',
    'Ι': 'I','Κ': 'K','Λ': 'L','Μ': 'M','Ν': 'N','Ξ': 'X','Ο': 'O','Π': 'P',
    'Ρ': 'R','Σ': 'S','Τ': 'T','Υ': 'Y','Φ': 'F','Χ': 'Ch','Ψ': 'Ps','Ω': 'O'
  };
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split('').map(c => map[c] || c).join('')
    .replace(/[^a-zA-Z0-9\-]/g, ""); // remove special chars
}

// ================= Helper: Debounce =================
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ================= Init Section Modules =================
document.addEventListener("DOMContentLoaded", () => {
  initBioSection();
  initAwardsSection();
  initInterestsSection();
  initBurialSection();
});
