// js/admin.js

/**
 * Module: admin.js
 * Διαχειρίζεται το admin panel:
 * - Έλεγχος authentication
 * - Φόρμα δημιουργίας/επεξεργασίας memorial
 * - Address autocomplete + Leaflet map
 * - Live αναζήτηση memorials
 * - Διαγραφή & επεξεργασία καταχωρήσεων
 * - Δημιουργία & εμφάνιση QR code
 * - Logout
 */

console.debug("[MODULE LOAD]", { module: "admin.js" });

/* ─── Utility: Greek → Latin slug ────────────────── */
/**
 * Μετατρέπει ελληνικούς χαρακτήρες σε λατινικούς
 * για τη δημιουργία URL-safe IDs.
 */
function toLatin(text) {
  const map = {
    'ά':'a','Ά':'A','έ':'e','Έ':'E','ή':'i','Ή':'I',
    'ί':'i','Ί':'I','ό':'o','Ό':'O','ώ':'o','Ώ':'O',
    'ύ':'y','Ύ':'Y','ϋ':'y','Ϋ':'Y',
    'α':'a','Α':'A','β':'b','Β':'B','γ':'g','Γ':'G',
    'δ':'d','Δ':'D','ε':'e','Ε':'E','ζ':'z','Ζ':'Z',
    'η':'i','Η':'I','θ':'th','Θ':'Th','ι':'i','Ι':'I',
    'κ':'k','Κ':'K','λ':'l','Λ':'L','μ':'m','Μ':'M',
    'ν':'n','Ν':'N','ξ':'x','Ξ':'X','ο':'o','Ο':'O',
    'π':'p','Π':'P','ρ':'r','Ρ':'R','σ':'s','Σ':'S',
    'ς':'s','τ':'t','υ':'y','Υ':'Y','φ':'f','Φ':'F',
    'χ':'ch','Χ':'Ch','ψ':'ps','Ψ':'Ps','ω':'o','Ω':'O'
  };
  return text.split('').map(c => map[c] || c).join('');
}

// ─── Imports ───────────────────────────────────────
import { supabase } from "./supabase.js";
import { initBioSection }      from "./sections/biography.js";
import { initAwardsSection }   from "./sections/awards.js";
import { initInterestsSection }from "./sections/interests.js";
import { initBurialSection }   from "./sections/burial.js";
import "./sections/relationships.js"; // UI & listeners for relationships

// --------------------------------------------------
// 1. Έλεγχος authentication
// --------------------------------------------------
(async () => {
  console.debug("[API CALL START]", { query: "supabase.auth.getSession" });
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  console.debug("[API CALL RESULT]", { data: session, error: authError });
  if (authError || !session) {
    console.warn("[AUTH FAIL]", "Χωρίς ενεργή συνεδρία – redirect to login");
    window.location.href = "/login.html";
    return;
  }
  console.debug("[AUTH OK]", { user: session.user.email });
})();

// --------------------------------------------------
// 2. DOM Elements & initial checks
// --------------------------------------------------
console.debug("[DOM INIT] Fetching DOM elements");
const memorialForm    = document.getElementById("memorialForm");
const hiddenIdInput   = document.getElementById("memorialId");
const logoutBtn       = document.getElementById("logoutBtn");
const qrPreview       = document.getElementById("qr-preview");
const firstInput      = document.getElementById("firstname");
const lastInput       = document.getElementById("lastname");
const birthDateInput  = document.getElementById("birth_date");
const deathDateInput  = document.getElementById("death_date");
const genderSelect    = document.getElementById("gender");
const regionInput     = document.getElementById("region");
const cityInput       = document.getElementById("city");
const messageInput    = document.getElementById("message");
const photoUrlInput   = document.getElementById("photoUrl");
const videoInput      = document.getElementById("video");
const birthPlaceInput = document.getElementById("birth_place");
const professionInput = document.getElementById("profession");
const educationInput  = document.getElementById("education");
const awardsInput     = document.getElementById("awards");
const interestsInput  = document.getElementById("interests");
const cemeteryInput   = document.getElementById("cemetery");
const genealogyInput  = document.getElementById("genealogy");
const addrIn          = document.getElementById("addressInput");
const suggList        = document.getElementById("suggestions");
const searchLastname  = document.getElementById("searchLastname");
const searchCity      = document.getElementById("searchCity");
const resultsContainer= document.getElementById("resultsContainer");

[
  ["memorialForm", memorialForm],
  ["memorialId", hiddenIdInput],
  ["logoutBtn", logoutBtn],
  ["qr-preview", qrPreview],
  ["firstname", firstInput],
  ["lastname", lastInput],
  ["birth_date", birthDateInput],
  ["death_date", deathDateInput],
  ["gender", genderSelect],
  ["region", regionInput],
  ["city", cityInput],
  ["message", messageInput],
  ["photoUrl", photoUrlInput],
  ["video", videoInput],
  ["birth_place", birthPlaceInput],
  ["profession", professionInput],
  ["education", educationInput],
  ["awards", awardsInput],
  ["interests", interestsInput],
  ["cemetery", cemeteryInput],
  ["genealogy", genealogyInput],
  ["addressInput", addrIn],
  ["suggestions", suggList],
  ["searchLastname", searchLastname],
  ["searchCity", searchCity],
  ["resultsContainer", resultsContainer]
].forEach(([name, el]) => {
  if (!el) console.warn("[DOM MISSING]", name);
  else     console.debug("[DOM FOUND]", name, el);
});

// --------------------------------------------------
// 3. Leaflet map initialization
// --------------------------------------------------
console.debug("[MODULE LOAD]", { module: "leaflet-map" });
const map = L.map("map").setView([37.9838, 23.7275], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:19 }).addTo(map);
const marker = L.marker([37.9838, 23.7275]).addTo(map);
console.debug("[DOM UPDATE]", { selector: "#map", action: "initialized" });

// --------------------------------------------------
// 4. Address Autocomplete (Nominatim)
// --------------------------------------------------
let addrTimer;
addrIn?.addEventListener("input", () => {
  clearTimeout(addrTimer);
  const q = addrIn.value.trim();
  if (q.length < 3) {
    console.debug("[AUTOCOMPLETE]", "query too short");
    suggList.innerHTML = "";
    return;
  }
  addrTimer = setTimeout(async () => {
    console.debug("[API CALL START]", { query: "Nominatim search", params: q });
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
      const places = await res.json();
      console.debug("[API CALL RESULT]", { data: places.slice(0,5) });
      suggList.innerHTML = places.slice(0,5).map(p =>
        `<li data-lat="${p.lat}" data-lon="${p.lon}">${p.display_name}</li>`
      ).join("");
      console.debug("[DOM UPDATE]", { selector: "#suggestions", html: "updated" });
    } catch (e) {
      console.error("[API ERROR]", e);
    }
  }, 300);
});
suggList?.addEventListener("click", e => {
  if (e.target.tagName !== "LI") return;
  console.debug("[EVENT]", "click", { item: e.target.textContent });
  const { lat, lon } = e.target.dataset;
  const [city, region] = e.target.textContent.split(",").map(s=>s.trim());
  cityInput.value   = city;
  regionInput.value = region;
  map.setView([lat, lon], 14);
  marker.setLatLng([lat, lon]);
  addrIn.value = "";
  suggList.innerHTML = "";
  console.debug("[DOM UPDATE]", { selector: "#map & inputs", action: "location set" });
});

// --------------------------------------------------
// 5. Live Search Memorials
// --------------------------------------------------
let searchTimer;
async function searchMemorials() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const ln = searchLastname.value.trim();
    const ct = searchCity.value.trim();
    console.debug("[API CALL START]", { query: "memorials.search", params: { ln, ct } });
    let q = supabase.from("memorials").select("*").limit(10);
    if (ln) q = q.ilike("last_name", `%${ln}%`);
    if (ct) q = q.ilike("city", `%${ct}%`);
    const { data, error } = await q;
    console.debug("[API CALL RESULT]", { data, error });
    resultsContainer.innerHTML = "";
    if (error) {
      resultsContainer.innerHTML = "<p>Σφάλμα κατά την αναζήτηση.</p>";
      return;
    }
    if (!data.length) {
      resultsContainer.innerHTML = "<p>Δεν βρέθηκαν καταχωρήσεις.</p>";
      return;
    }
    data.forEach(entry => {
      const div = document.createElement("div");
      div.style = "border:1px solid #ccc; padding:1rem; margin-bottom:1rem; border-radius:5px;";
      div.innerHTML = `
        <strong>${entry.first_name} ${entry.last_name}</strong><br/>
        <small>${entry.city}, ${entry.region}</small><br/>
        <button class="editBtn" data-id="${entry.id}">✏️</button>
        <button class="deleteBtn" data-id="${entry.id}">🗑️</button>
      `;
      resultsContainer.appendChild(div);
    });
    console.debug("[DOM UPDATE]", { selector: "#resultsContainer", action: "rendered" });
    attachDeleteListeners();
    document.querySelectorAll(".editBtn").forEach(btn => btn.addEventListener("click", loadForEdit));
  }, 300);
}
[searchLastname, searchCity].forEach(el => el?.addEventListener("input", searchMemorials));
resultsContainer.innerHTML = "<p>Πληκτρολόγησε για αναζήτηση…</p>";

// --------------------------------------------------
// 6. Delete helper
// --------------------------------------------------
function attachDeleteListeners() {
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.replaceWith(btn.cloneNode(true)); // remove old listeners
  });
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      console.debug("[EVENT]", "delete click", { id: btn.dataset.id });
      if (!confirm("Θέλετε σίγουρα να διαγράψετε;")) return;
      console.debug("[API CALL START]", { query: "delete memorial & related", params: btn.dataset.id });
      await supabase.storage.from("qr-codes").remove([`${btn.dataset.id}.png`]);
      await supabase.from("relationships").delete().eq("memorial_id", btn.dataset.id);
      const { error } = await supabase.from("memorials").delete().eq("id", btn.dataset.id);
      console.debug("[API CALL RESULT]", { error });
      if (error) {
        console.error("[API ERROR]", error);
        alert("Σφάλμα κατά τη διαγραφή.");
      } else {
        btn.closest("div").remove();
        console.debug("[DOM UPDATE]", { action: "removed element" });
        alert("Διαγράφηκε επιτυχώς.");
      }
    });
  });
}

// --------------------------------------------------
// 7. Load for edit
// --------------------------------------------------
async function loadForEdit() {
  const id = this.dataset.id;
  console.debug("[EVENT]", "edit click", { id });
  console.debug("[API CALL START]", { query: "select memorial", params: id });
  const { data, error } = await supabase.from("memorials").select("*").eq("id", id).single();
  console.debug("[API CALL RESULT]", { data, error });
  if (error || !data) {
    console.error("[API ERROR]", error);
    return alert("Δεν βρέθηκε η καταχώρηση.");
  }

  // Populate form fields
  hiddenIdInput.value        = data.id;
  firstInput.value           = data.first_name;
  lastInput.value            = data.last_name;
  birthDateInput.value       = data.birth_date  || "";
  deathDateInput.value       = data.death_date  || "";
  genderSelect.value         = data.gender      || "";
  regionInput.value          = data.region      || "";
  cityInput.value            = data.city        || "";
  messageInput.value         = data.message     || "";
  photoUrlInput.value        = data.photo_url   || "";
  videoInput.value           = data.youtube_url || "";
  birthPlaceInput.value      = data.birth_place || "";
  professionInput.value      = data.profession  || "";
  educationInput.value       = data.education   || "";
  awardsInput.value          = data.awards      || "";
  interestsInput.value       = data.interests   || "";
  cemeteryInput.value        = data.cemetery    || "";
  genealogyInput.value       = data.genealogy   || "";
  console.debug("[DOM UPDATE]", { action: "fields populated" });

  // Load relationships into table with id "relations-table"
  console.debug("[API CALL START]", { query: "select relationships", params: id });
  const { data: rels, error: relErr } = await supabase
    .from("relationships")
    .select("*")
    .eq("memorial_id", id);
  console.debug("[API CALL RESULT]", { data: rels, error: relErr });

  const table = document.getElementById("relations-table");
  if (!table) {
    console.warn("[DOM MISSING]", "relations-table");
  } else {
    const tbody = table.querySelector("tbody");
    tbody.innerHTML = "";
    if (!rels.length) {
      tbody.innerHTML = `<tr id="noRelationshipsRow"><td colspan="2" style="text-align:center">Δεν υπάρχουν.</td></tr>`;
    } else {
      rels.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${r.relative_id}</td><td>${r.relation_type}</td>`;
        tbody.appendChild(tr);
      });
    }
    console.debug("[DOM UPDATE]", { action: "relationships populated" });
  }
  attachDeleteListeners();
}

// --------------------------------------------------
// 8. Form submit handler (create/update)
// --------------------------------------------------
memorialForm?.addEventListener("submit", async e => {
  e.preventDefault();
  console.debug("[EVENT]", "submit", {
    firstname: firstInput.value,
    lastname:  lastInput.value,
    city:      cityInput.value,
    id:        hiddenIdInput.value
  });

  // Basic validation
  if (!firstInput.value || !lastInput.value || !cityInput.value) {
    console.warn("[VALIDATION]", "required fields missing");
    return alert("Συμπλήρωσε Όνομα, Επώνυμο και Πόλη.");
  }

  // Birth/death date logic
  if (birthDateInput.value && deathDateInput.value &&
      new Date(birthDateInput.value) > new Date(deathDateInput.value)) {
    console.warn("[VALIDATION]", "birth > death");
    return alert("Η ημερομηνία γέννησης δεν μπορεί να είναι μετά τον θάνατο.");
  }

  // Determine ID
  let id = hiddenIdInput.value.trim() || null;
  const isNew = !id;
  const rawLast = lastInput.value.trim();
  const rawCity = cityInput.value.trim();

  if (isNew) {
    // generate slug ID
    const latinLast = toLatin(rawLast).toLowerCase().replace(/\s+/g, '');
    const citySlug  = toLatin(rawCity).toLowerCase().replace(/\s+/g, '');
    console.debug("[SLUGIZE]", { latinLast, citySlug });

    const { count } = await supabase
      .from("memorials")
      .select('*', { head: true, count: 'exact' })
      .ilike('last_name', `%${latinLast}%`)
      .ilike('city',     `%${citySlug}%`);
    console.debug("[COUNT]", { count });

    id = `${latinLast}${citySlug}A${(count || 0) + 1}`;
    console.debug("[ID GEN]", { id });
  }

  // Upsert memorial
  console.debug("[API CALL START]", { query: "upsert memorial", params: { id } });
  const { error: upErr } = await supabase.from("memorials").upsert({
    id,
    first_name: firstInput.value,
    last_name:  lastInput.value,
    birth_date: birthDateInput.value || null,
    death_date: deathDateInput.value || null,
    gender:     genderSelect.value,
    region:     regionInput.value,
    city:       cityInput.value,
    message:    messageInput.value,
    photo_url:  photoUrlInput.value,
    youtube_url:videoInput.value,
    candles:    0,
    created_at: new Date().toISOString(),
    birth_place: birthPlaceInput.value,
    profession: professionInput.value,
    education:  educationInput.value,
    awards:     awardsInput.value,
    interests:  interestsInput.value,
    cemetery:   cemeteryInput.value,
    genealogy:  genealogyInput.value
  }, { onConflict: ['id'] });
  console.debug("[API CALL RESULT]", { error: upErr });
  if (upErr) {
    console.error("[API ERROR]", upErr);
    return alert("Σφάλμα κατά την αποθήκευση.");
  }

  // Relationships: refresh
  console.debug("[API CALL START]", { query: "refresh relationships", params: id });
  await supabase.from("relationships").delete().eq("memorial_id", id);
  const relRows = Array.from(document.querySelectorAll("#relations-table tbody tr"))
    .filter(tr => tr.id !== "noRelationshipsRow");
  if (relRows.length) {
    const toInsert = relRows.map(tr => ({
      memorial_id:  id,
      relative_id:  tr.children[0].textContent.trim(),
      relation_type: tr.children[1].textContent.trim()
    }));
    console.debug("[API CALL START]", { query: "insert relationships", params: toInsert });
    await supabase.from("relationships").insert(toInsert);
  }
  console.debug("[API CALL RESULT]", { action: "relationships refreshed" });

  // QR code generation & upload (new only)
  if (isNew) {
    const url = `${location.origin}/memorial.html?id=${id}`;
    console.debug("[API CALL START]", { query: "fetch QR", params: url });
    const qrBlob = await (await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`
    )).blob();
    console.debug("[API CALL RESULT]", { data: "QR blob fetched" });
    console.debug("[API CALL START]", { query: "upload QR", params: `${id}.png` });
    await supabase.storage.from("qr-codes").upload(`${id}.png`, qrBlob, { contentType: "image/png" });
    console.debug("[API CALL RESULT]", { action: "QR uploaded" });
  }

  // Display QR preview
  console.debug("[API CALL START]", { query: "getPublicUrl", params: `${id}.png` });
  const { data: pu } = supabase.storage.from("qr-codes").getPublicUrl(`${id}.png`);
  console.debug("[API CALL RESULT]", { data: pu });
  qrPreview.innerHTML = `
    <img src="${pu.publicUrl}" style="max-width:300px; margin-bottom:1rem;">
    <div><a href="${location.origin}/memorial.html?id=${id}" target="_blank">${location.origin}/memorial.html?id=${id}</a></div>
    <a href="${pu.publicUrl}" download="${id}.png">⬇️ Κατέβασε το QR</a>
  `;
  console.debug("[DOM UPDATE]", { selector: "#qr-preview", action: "updated" });

  alert("✅ Καταχώρηση επιτυχής!");
  memorialForm.reset();
  hiddenIdInput.value = "";
  document.querySelector("#relations-table tbody").innerHTML = `
    <tr id="noRelationshipsRow"><td colspan="2" style="text-align:center">Δεν υπάρχουν.</td></tr>
  `;
  attachDeleteListeners();
  console.debug("[DOM UPDATE]", { selector: "#memorialForm", action: "reset" });
});

// --------------------------------------------------
// 9. Logout
// --------------------------------------------------
logoutBtn?.addEventListener("click", async () => {
  console.debug("[EVENT]", "click", { id: "logoutBtn" });
  console.debug("[API CALL START]", { query: "supabase.auth.signOut" });
  const { error } = await supabase.auth.signOut();
  console.debug("[API CALL RESULT]", { error });
  if (error) {
    console.error("[API ERROR]", error);
    return alert("Σφάλμα κατά την αποσύνδεση.");
  }
  window.location.href = "/login.html";
});

// --------------------------------------------------
// 10. Init sections on load
// --------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  console.debug("[DOC READY] Initializing sections");
  initBioSection();
  initAwardsSection();
  initInterestsSection();
  initBurialSection();
  attachDeleteListeners();
});
