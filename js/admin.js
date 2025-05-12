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
import { supabase }               from "./supabase.js";
import { initBioSection }         from "./sections/biography.js";
import { initAwardsSection }      from "./sections/awards.js";
import { initInterestsSection }   from "./sections/interests.js";
import { initBurialSection }      from "./sections/burial.js";
import { initRelationships }      from "./sections/relationships.js"; // νέο
import "./sections/relationships.js"; // παλιό, διατήρησέ το για backward compat

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
  } else {
    console.debug("[AUTH OK]", { user: session.user.email });
  }
})();

// --------------------------------------------------
// Όλα τα υπόλοιπα **ΜΕΤΑ** το DOMContentLoaded
// --------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  console.debug("[DOC READY]", "Initializing admin panel");

  // ─── 2. DOM Elements & Checks ───────────────────
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
  const relationsHeader = document.getElementById("relationsHeader");

  // Επιβεβαιώσεις
  [
    ["memorialForm", memorialForm],
    ["logoutBtn", logoutBtn],
    ["addressInput", addrIn],
    ["suggestions", suggList],
    ["genealogy", genealogyInput],
    ["relationsHeader", relationsHeader]
  ].forEach(([name, el]) => {
    if (!el) console.warn("[DOM MISSING]", name);
    else     console.debug("[DOM FOUND]", name, el);
  });

  // ─── 3. Leaflet map initialization ─────────────
  console.debug("[MODULE LOAD]", { module: "leaflet-map" });
  const map = L.map("map").setView([37.9838, 23.7275], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:19 }).addTo(map);
  const marker = L.marker([37.9838, 23.7275]).addTo(map);

  // ─── 4. Address Autocomplete ────────────────────
  let addrTimer;
  addrIn?.addEventListener("input", () => {
    clearTimeout(addrTimer);
    const q = addrIn.value.trim();
    if (q.length < 3) {
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
      } catch(e){
        console.error("[API ERROR]", e);
      }
    },300);
  });
  suggList?.addEventListener("click", e => {
    if (e.target.tagName!=="LI") return;
    const {lat, lon} = e.target.dataset;
    const [city, region] = e.target.textContent.split(",").map(s=>s.trim());
    cityInput.value = city;
    regionInput.value = region;
    map.setView([lat,lon],14);
    marker.setLatLng([lat,lon]);
    addrIn.value = "";
    suggList.innerHTML = "";
  });

  // ─── 5. Live Search Memorials ───────────────────
  let searchTimer;
  async function searchMemorials(){
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async ()=>{
      const ln = searchLastname.value.trim();
      const ct = searchCity.value.trim();
      console.debug("[API CALL START]", { query:"memorials.search", ln, ct });
      let q = supabase.from("memorials").select("*").limit(10);
      if(ln) q = q.ilike("last_name",`%${ln}%`);
      if(ct) q = q.ilike("city",`%${ct}%`);
      const { data, error } = await q;
      console.debug("[API CALL RESULT]", { data, error });
      resultsContainer.innerHTML = error 
        ? "<p>Σφάλμα.</p>"
        : (!data.length 
            ? "<p>Δεν βρέθηκαν.</p>" 
            : data.map(e=>`
              <div style="border:1px solid #ccc;padding:1rem;margin-bottom:1rem;border-radius:5px">
                <strong>${e.first_name} ${e.last_name}</strong><br/>
                <small>${e.city}, ${e.region}</small><br/>
                <button class="editBtn" data-id="${e.id}">✏️</button>
                <button class="deleteBtn" data-id="${e.id}">🗑️</button>
              </div>
            `).join("")
          );
      attachDeleteListeners();
      document.querySelectorAll(".editBtn").forEach(btn=>btn.addEventListener("click", loadForEdit));
    },300);
  }
  [searchLastname, searchCity].forEach(el=>el?.addEventListener("input", searchMemorials));
  resultsContainer.innerHTML="<p>Πληκτρολόγησε για αναζήτηση…</p>";

  // ─── 6. Delete helper ───────────────────────────
  function attachDeleteListeners(){
    document.querySelectorAll(".deleteBtn").forEach(btn=>{
      btn.replaceWith(btn.cloneNode(true));
    });
    document.querySelectorAll(".deleteBtn").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        if(!confirm("Διαγραφή;")) return;
        console.debug("[API CALL START]", { query:"delete memorial", id:btn.dataset.id });
        await supabase.storage.from("qr-codes").remove([`${btn.dataset.id}.png`]);
        await supabase.from("relationships").delete().eq("memorial_id",btn.dataset.id);
        const { error } = await supabase.from("memorials").delete().eq("id",btn.dataset.id);
        if(error) { alert("Σφάλμα."); return; }
        btn.closest("div").remove();
      });
    });
  }

  // ─── 7. Load for edit ───────────────────────────
  async function loadForEdit(){
    const id = this.dataset.id;
    console.debug("[API CALL START]", { query:"select memorial", id });
    const { data, error } = await supabase.from("memorials").select("*").eq("id",id).single();
    if(error||!data){ alert("Δεν βρέθηκε."); return; }
    // Populate form
    hiddenIdInput.value        = data.id;
    firstInput.value           = data.first_name;
    lastInput.value            = data.last_name;
    birthDateInput.value       = data.birth_date||"";
    deathDateInput.value       = data.death_date||"";
    genderSelect.value         = data.gender||"";
    regionInput.value          = data.region||"";
    cityInput.value            = data.city||"";
    messageInput.value         = data.message||"";
    photoUrlInput.value        = data.photo_url||"";
    videoInput.value           = data.youtube_url||"";
    birthPlaceInput.value      = data.birth_place||"";
    professionInput.value      = data.profession||"";
    educationInput.value       = data.education||"";
    awardsInput.value          = data.awards||"";
    interestsInput.value       = data.interests||"";
    cemeteryInput.value        = data.cemetery||"";
    genealogyInput.value       = data.genealogy||"";
    // Ενημέρωση τίτλου σχέσεων
    relationsHeader.textContent = `${data.first_name} ${data.last_name} — Σχέσεις`;

    // Load relationships
    console.debug("[API CALL START]", { query:"select relationships", id });
    const { data:rels } = await supabase.from("relationships").select("*").eq("memorial_id",id);
    const tbody = document.querySelector("#relations-table tbody");
    tbody.innerHTML = "";
    if(!rels.length){
      tbody.innerHTML = `<tr id="noRelationshipsRow"><td colspan="2" style="text-align:center">Δεν υπάρχουν.</td></tr>`;
    } else {
      rels.forEach(r=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `<td data-id="${r.relative_id}">${r.relative_first_name} ${r.relative_last_name}</td><td>${r.relation_type}</td><td><button class="deleteBtn">🗑️</button></td>`;
        tbody.appendChild(tr);
      });
    }
    attachDeleteListeners();
  }

  // ─── 8. Form submit handler ──────────────────────
  memorialForm?.addEventListener("submit", async e=>{
    e.preventDefault();
    // Update relations header as user types
    [firstInput, lastInput].forEach(inp=>{
      inp.addEventListener("input", ()=>{
        const fn = firstInput.value.trim();
        const ln = lastInput.value.trim();
        relationsHeader.textContent = (fn||ln)
          ? `${fn} ${ln} — Σχέσεις`
          : "Σχέσεις";
      });
    });

    // Basic validation
    if(!firstInput.value.trim()||!lastInput.value.trim()||!cityInput.value.trim()){
      return alert("Συμπλήρωσε Όνομα, Επώνυμο & Πόλη.");
    }
    if(birthDateInput.value && deathDateInput.value &&
       new Date(birthDateInput.value) > new Date(deathDateInput.value)){
      return alert("Η ημερομηνία γέννησης δεν μπορεί να είναι μετά τον θάνατο.");
    }

    // Determine ID
    let id = hiddenIdInput.value.trim()||null;
    const isNew = !id;
    const rawLast = lastInput.value.trim();
    const rawCity = cityInput.value.trim();
    if(isNew){
      const latinLast = toLatin(rawLast).toLowerCase().replace(/\s+/g,'');
      const citySlug  = toLatin(rawCity).toLowerCase().replace(/\s+/g,'');
      const { count } = await supabase
        .from("memorials")
        .select("*",{ head:true,count:'exact' })
        .ilike("last_name",`%${latinLast}%`)
        .ilike("city",`%${citySlug}%`);
      id = `${latinLast}${citySlug}A${(count||0)+1}`;
    }

    // Upsert memorial
    await supabase.from("memorials").upsert({
      id,
      first_name: firstInput.value.trim(),
      last_name:  lastInput.value.trim(),
      birth_date: birthDateInput.value||null,
      death_date: deathDateInput.value||null,
      gender:     genderSelect.value,
      region:     regionInput.value.trim(),
      city:       cityInput.value.trim(),
      message:    messageInput.value.trim(),
      photo_url:  photoUrlInput.value.trim(),
      youtube_url:videoInput.value.trim(),
      candles:    0,
      created_at: new Date().toISOString(),
      birth_place: birthPlaceInput.value.trim(),
      profession: professionInput.value.trim(),
      education:  educationInput.value.trim(),
      awards:     awardsInput.value.trim(),
      interests:  interestsInput.value.trim(),
      cemetery:   cemeteryInput.value.trim(),
      genealogy:  genealogyInput.value.trim()
    },{ onConflict:['id'] });

    // Refresh relationships
    await supabase.from("relationships").delete().eq("memorial_id",id);
    const relRows = Array.from(document.querySelectorAll("#relations-table tbody tr"))
      .filter(tr=>tr.id!=="noRelationshipsRow");
    if(relRows.length){
      const toInsert = relRows.map(tr=>({
        memorial_id: id,
        relative_id: tr.children[0].dataset.id,
        relation_type: tr.children[1].textContent.trim()
      }));
      await supabase.from("relationships").insert(toInsert);
    }

    // QR code for new
    if(isNew){
      const url = `${location.origin}/memorial.html?id=${id}`;
      const blob = await (await fetch(
        `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`
      )).blob();
      await supabase.storage.from("qr-codes").upload(`${id}.png`, blob, { contentType:"image/png" });
    }

    // Show QR preview
    const { data:pu } = supabase.storage.from("qr-codes").getPublicUrl(`${id}.png`);
    qrPreview.innerHTML = `
      <img src="${pu.publicUrl}" style="max-width:300px; margin-bottom:1rem;">
      <div><a href="${location.origin}/memorial.html?id=${id}" target="_blank">${location.origin}/memorial.html?id=${id}</a></div>
      <a href="${pu.publicUrl}" download="${id}.png">⬇️ Κατέβασε το QR</a>
    `;

    // Reset form
    memorialForm.reset();
    hiddenIdInput.value = "";
    document.querySelector("#relations-table tbody").innerHTML = `
      <tr id="noRelationshipsRow"><td colspan="2" style="text-align:center">Δεν υπάρχουν.</td></tr>
    `;
    attachDeleteListeners();

    alert("Καταχωρήθηκε!");
  });

  // ─── 9. Logout ───────────────────────────────────
  logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/login.html";
  });

  // ─── 10. Init Sections ───────────────────────────
  initBioSection();
  initAwardsSection();
  initInterestsSection();
  initBurialSection();
  initRelationships();
  attachDeleteListeners();
});
