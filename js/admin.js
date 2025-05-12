// js/admin.js

import { supabase } from "./supabase.js";
import { initBioSection }   from "./sections/biography.js";
import { initAwardsSection }    from "./sections/awards.js";
import { initInterestsSection } from "./sections/interests.js";
import { initBurialSection }    from "./sections/burial.js";
// Το relationships.js χειρίζεται μόνο το UI & listeners για τον πίνακα σχέσεων
import "./sections/relationships.js";

// ================= Utility: Greek → Latin =================
function toLatin(text) {
  const latinMap = {
    'ά':'a','Ά':'A','έ':'e','Έ':'E','ή':'i','Ή':'I',
    'ί':'i','Ί':'I','ό':'o','Ό':'O','ώ':'o','Ώ':'O',
    'ύ':'y','Ύ':'Y','ϋ':'y','Ϋ':'Y','α':'a','Α':'A',
    'β':'b','Β':'B','γ':'g','Γ':'G','δ':'d','Δ':'D',
    'ε':'e','Ε':'E','ζ':'z','Ζ':'Z','η':'i','Η':'I',
    'θ':'th','Θ':'Th','ι':'i','Ι':'I','κ':'k','Κ':'K',
    'λ':'l','Λ':'L','μ':'m','Μ':'M','ν':'n','Ν':'N',
    'ξ':'x','Ξ':'X','ο':'o','Ο':'O','π':'p','Π':'P',
    'ρ':'r','Ρ':'R','σ':'s','Σ':'S','ς':'s','τ':'t',
    'υ':'y','Υ':'Y','φ':'f','Φ':'F','χ':'ch','Χ':'Ch',
    'ψ':'ps','Ψ':'Ps','ω':'o','Ω':'O'
  };
  return text.split('').map(c => latinMap[c] || c).join('');
}

// ================= Auth redirect =================
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "/login.html";
  }
})();

// ================= DOM elements =================
const form             = document.getElementById("memorialForm");
const hiddenIdInput    = document.getElementById("memorialId"); // <input type="hidden" id="memorialId">
const logoutBtn        = document.getElementById("logoutBtn");
const qrPreview        = document.getElementById("qr-preview");
const addrIn           = document.getElementById("addressInput");
const suggList         = document.getElementById("suggestions");
let addrTimer;

// ================= Address autocomplete & Leaflet map =================
addrIn.addEventListener("input", () => {
  clearTimeout(addrTimer);
  const q = addrIn.value.trim();
  if (q.length < 3) {
    suggList.innerHTML = "";
    return;
  }
  addrTimer = setTimeout(async () => {
    try {
      const res    = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`
      );
      const places = await res.json();
      suggList.innerHTML = places.slice(0,5).map(p =>
        `<li data-lat="${p.lat}" data-lon="${p.lon}">${p.display_name}</li>`
      ).join("");
    } catch (err) {
      console.error("Autocomplete error:", err);
    }
  }, 300);
});

suggList.addEventListener("click", e => {
  if (e.target.tagName !== "LI") return;
  const { lat, lon } = e.target.dataset;
  const parts = e.target.textContent.split(",");
  document.getElementById("region").value = parts[1]?.trim() || "";
  document.getElementById("city").value   = parts[0]?.trim() || "";
  map.setView([lat, lon], 14);
  marker.setLatLng([lat, lon]);
  addrIn.value = "";
  suggList.innerHTML = "";
});

// Leaflet init
const map    = L.map("map").setView([37.9838, 23.7275], 6);
const marker = L.marker([37.9838, 23.7275]).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

// ================= Delete‐buttons helper =================
function attachDeleteListeners() {
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.replaceWith(btn.cloneNode(true));
  });
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!confirm("Θες σίγουρα να διαγράψεις αυτό το memorial;")) return;
      // Σβήσιμο QR
      await supabase.storage.from("qr-codes").remove([`${id}.png`]);
      // Σχέσεις
      await supabase.from("relationships").delete().eq("memorial_id", id);
      // Memorial
      const { error } = await supabase.from("memorials").delete().eq("id", id);
      if (error) {
        alert("❌ Σφάλμα διαγραφής.");
      } else {
        btn.closest("div").remove();
        alert("✅ Διαγράφηκε memorial, σχέσεις & QR.");
      }
    });
  });
}

// ================= Search existing memorials (debounced) =================
const searchLastname   = document.getElementById("searchLastname");
const searchCity       = document.getElementById("searchCity");
const resultsContainer = document.getElementById("resultsContainer");
let searchTimer;

async function searchMemorials() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const ln = searchLastname.value.trim();
    const ct = searchCity.value.trim();
    let q = supabase.from("memorials").select("*").limit(10);
    if (ln) q = q.ilike("last_name", `%${ln}%`);
    if (ct) q = q.ilike("city",     `%${ct}%`);
    const { data, error } = await q;
    resultsContainer.innerHTML = "";
    if (error) {
      resultsContainer.innerHTML = "<p>❌ Σφάλμα αναζήτησης.</p>";
      return;
    }
    if (!data.length) {
      resultsContainer.innerHTML = "<p>❌ Δεν βρέθηκαν αποτελέσματα.</p>";
      return;
    }
    data.forEach(entry => {
      const div = document.createElement("div");
      div.style = "border:1px solid #ccc;padding:1rem;margin-bottom:1rem;border-radius:5px";
      div.innerHTML = `
        <strong>${entry.first_name} ${entry.last_name}</strong><br/>
        <small>${entry.city}, ${entry.region}</small><br/>
        <button class="editBtn" data-id="${entry.id}">✏️ Επεξεργασία</button>
        <button class="deleteBtn" data-id="${entry.id}">🗑️ Διαγραφή</button>
      `;
      resultsContainer.appendChild(div);
    });
    attachDeleteListeners();
    document.querySelectorAll(".editBtn").forEach(btn => {
      btn.addEventListener("click", loadForEdit);
    });
  }, 300);
}

[ searchLastname, searchCity ].forEach(el =>
  el.addEventListener("input", searchMemorials)
);
resultsContainer.innerHTML = "<p>Πληκτρολόγησε για να αναζητήσεις…</p>";

// ================= Load for edit =================
async function loadForEdit() {
  const id = this.dataset.id;
  const { data, error } = await supabase
    .from("memorials")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) {
    alert("Δεν βρέθηκε.");
    return;
  }
  // Κρυφό πεδίο ID
  hiddenIdInput.value = data.id;
  // Fill βασικά πεδία
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
  // Extra fields
  form.birth_place.value = data.birth_place  || "";
  form.profession.value  = data.profession   || "";
  form.education.value   = data.education    || "";
  form.awards.value      = data.awards       || "";
  form.interests.value   = data.interests    || "";
  form.cemetery.value    = data.cemetery     || "";
  form.genealogy.value   = data.genealogy    || "";
  // Σχέσεις
  const { data: rels } = await supabase
    .from("relationships")
    .select("*")
    .eq("memorial_id", data.id);
  const tbody = document.querySelector("#relationshipsTable tbody");
  tbody.innerHTML = "";
  if (!rels.length) {
    tbody.innerHTML = `
      <tr id="noRelationshipsRow">
        <td colspan="2" style="text-align:center;">Δεν υπάρχουν καταχωρημένες σχέσεις.</td>
      </tr>`;
  } else {
    rels.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.relative_first_name} ${r.relative_last_name}</td>
        <td>${r.relation_type}</td>
      `;
      tbody.appendChild(tr);
    });
  }
  attachDeleteListeners();
}

// ================= Submit handler =================
form.addEventListener("submit", async e => {
  e.preventDefault();

  // Gather + validation
  const rawFirst = form.firstname.value.trim();
  const rawLast  = form.lastname.value.trim();
  const rawCity  = form.city.value.trim();
  if (!rawFirst || !rawLast || !rawCity) {
    alert("Συμπλήρωσε Όνομα, Επώνυμο, Πόλη.");
    return;
  }
  const birthDate = form.birth_date.value || null;
  const deathDate = form.death_date.value || null;
  if (birthDate && deathDate && new Date(birthDate) > new Date(deathDate)) {
    alert("❌ Η ημερομηνία γέννησης δεν μπορεί να είναι μετά τον θάνατο.");
    return;
  }

  // Determine new vs edit
  const existingId = hiddenIdInput.value.trim();
  let id, isNew;
  if (existingId) {
    id    = existingId;
    isNew = false;
  } else {
    isNew = true;
    const latinLast = toLatin(rawLast).toLowerCase();
    const citySlug  = toLatin(rawCity).toLowerCase();
    const { count } = await supabase
      .from("memorials")
      .select("*", { head: true, count: "exact" })
      .ilike("last_name", latinLast)
      .ilike("city", citySlug);
    id = `${latinLast}${citySlug}A${(count||0)+1}`.replace(/\s+/g,'');
  }

  // Extra fields
  const birth_place = form.birth_place.value.trim();
  const profession  = form.profession.value.trim();
  const education   = form.education.value.trim();
  const awards      = form.awards.value.trim();
  const interests   = form.interests.value.trim();
  const cemetery    = form.cemetery.value.trim();
  const genealogy   = form.genealogy.value.trim();

  // Upsert memorial
  const { error: upErr } = await supabase
    .from("memorials")
    .upsert({
      id,
      first_name:  rawFirst,
      last_name:   toLatin(rawLast).toLowerCase(),
      birth_date:  birthDate,
      death_date:  deathDate,
      gender:      form.gender.value,
      region:      form.region.value.trim(),
      city:        rawCity,
      message:     form.message.value.trim(),
      photo_url:   form.photoUrl.value.trim(),
      youtube_url: form.video.value.trim(),
      candles:     0,
      created_at:  new Date().toISOString(),
      birth_place,
      profession,
      education,
      awards,
      interests,
      cemetery,
      genealogy
    }, { onConflict: ['id'] });
  if (upErr) {
    console.error(upErr);
    alert("❌ Σφάλμα αποθήκευσης.");
    return;
  }

  // Relationships
  await supabase.from("relationships").delete().eq("memorial_id", id);
  const relRows = Array.from(document.querySelectorAll("#relationshipsTable tbody tr"));
  if (relRows.length && relRows[0].id !== "noRelationshipsRow") {
    const toInsert = relRows.map(tr => ({
      memorial_id:   id,
      relative_id:   tr.children[0].dataset.id,
      relation_type: tr.children[1].textContent.trim()
    }));
    await supabase.from("relationships").insert(toInsert);
  }

  // QR code – μόνο για νέα εγγραφή
  if (isNew) {
    const url    = `${location.origin}/memorial.html?id=${id}`;
    const qrBlob = await (await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`
    )).blob();
    await supabase
      .storage
      .from("qr-codes")
      .upload(`${id}.png`, qrBlob, { contentType: "image/png" });
  }

  // Show QR preview
  const { data: pu } = supabase.storage.from("qr-codes").getPublicUrl(`${id}.png`);
  qrPreview.innerHTML = `
    <img src="${pu.publicUrl}" style="max-width:300px;margin-bottom:1rem;">
    <div><a href="${location.origin}/memorial.html?id=${id}" target="_blank">
      ${location.origin}/memorial.html?id=${id}
    </a></div>
    <a href="${pu.publicUrl}" download="${id}.png">⬇️ Κατέβασε το QR Code</a>
  `;

  alert("✅ Το memorial καταχωρήθηκε!");

  // Reset form
  form.reset();
  hiddenIdInput.value = "";
  document.querySelector("#relationshipsTable tbody").innerHTML = `
    <tr id="noRelationshipsRow">
      <td colspan="2" style="text-align:center;">Δεν υπάρχουν καταχωρημένες σχέσεις.</td>
    </tr>`;
  attachDeleteListeners();
});

// ================= Logout handler =================
logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/login.html";
});

// ================= Init other sections =================
document.addEventListener("DOMContentLoaded", () => {
  initBioSection();
  initAwardsSection();
  initInterestsSection();
  initBurialSection();
  attachDeleteListeners();
});
