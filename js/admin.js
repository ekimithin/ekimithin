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
import { initRelationships }   from "./sections/relationships.js";

// --------------------------------------------------
// 1. Έλεγχος authentication
// --------------------------------------------------
(async () => {
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  if (authError || !session) {
    window.location.href = "/login.html";
    return;
  }
})();

// --------------------------------------------------
// 2. DOM Elements
// --------------------------------------------------
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

// --------------------------------------------------
// 3. Leaflet map initialization
// --------------------------------------------------
const map = L.map("map").setView([37.9838, 23.7275], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:19 }).addTo(map);
const marker = L.marker([37.9838, 23.7275]).addTo(map);

// --------------------------------------------------
// 4. Address Autocomplete (Nominatim)
// --------------------------------------------------
let addrTimer;
addrIn?.addEventListener("input", () => {
  clearTimeout(addrTimer);
  const q = addrIn.value.trim();
  if (q.length < 3) { suggList.innerHTML=""; return; }
  addrTimer = setTimeout(async () => {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
    const places = await res.json();
    suggList.innerHTML = places.slice(0,5).map(p =>
      `<li data-lat="${p.lat}" data-lon="${p.lon}">${p.display_name}</li>`
    ).join("");
  }, 300);
});
suggList?.addEventListener("click", e => {
  if (e.target.tagName!=="LI") return;
  const { lat, lon } = e.target.dataset;
  const [city, region] = e.target.textContent.split(",").map(s=>s.trim());
  cityInput.value   = city;
  regionInput.value = region;
  map.setView([lat, lon],14);
  marker.setLatLng([lat, lon]);
  addrIn.value=""; suggList.innerHTML="";
});

// --------------------------------------------------
// 5. Live Search Memorials
// --------------------------------------------------
let searchTimer;
async function searchMemorials() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    let q = supabase.from("memorials").select("*").limit(10);
    if (searchLastname.value) q = q.ilike("last_name", `%${searchLastname.value}%`);
    if (searchCity.value)     q = q.ilike("city",      `%${searchCity.value}%`);
    const { data, error } = await q;
    resultsContainer.innerHTML = "";
    if (error) { resultsContainer.innerHTML="<p>Σφάλμα.</p>"; return; }
    if (!data.length) { resultsContainer.innerHTML="<p>Δεν βρέθηκαν.</p>"; return; }
    data.forEach(entry=>{
      const div = document.createElement("div");
      div.style="border:1px solid #ccc;padding:1rem;margin-bottom:1rem;border-radius:5px";
      div.innerHTML=`
        <strong>${entry.first_name} ${entry.last_name}</strong><br/>
        <small>${entry.city}, ${entry.region}</small><br/>
        <button class="editBtn" data-id="${entry.id}">✏️</button>
        <button class="deleteBtn" data-id="${entry.id}">🗑️</button>
      `;
      resultsContainer.appendChild(div);
    });
    attachDeleteListeners();
    document.querySelectorAll(".editBtn").forEach(btn=>btn.addEventListener("click", loadForEdit));
  },300);
}
[searchLastname,searchCity].forEach(el=>el?.addEventListener("input",searchMemorials));

// --------------------------------------------------
// 6. Delete helper
// --------------------------------------------------
function attachDeleteListeners(){
  document.querySelectorAll(".deleteBtn").forEach(btn=>{
    btn.replaceWith(btn.cloneNode(true));
  });
  document.querySelectorAll(".deleteBtn").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      if(!confirm("Θέλετε σίγουρα;")) return;
      await supabase.storage.from("qr-codes").remove([`${btn.dataset.id}.png`]);
      await supabase.from("relationships").delete().eq("memorial_id",btn.dataset.id);
      await supabase.from("memorials").delete().eq("id",btn.dataset.id);
      btn.closest("div").remove();
    });
  });
}

// --------------------------------------------------
// 7. Load for edit
// --------------------------------------------------
async function loadForEdit(){
  const id = this.dataset.id;
  const { data, error } = await supabase.from("memorials").select("*").eq("id",id).single();
  if(error||!data) return alert("Δεν βρέθηκε.");
  Object.assign(hiddenIdInput, { value:data.id });
  Object.assign(firstInput,      { value:data.first_name });
  Object.assign(lastInput,       { value:data.last_name });
  birthDateInput.value = data.birth_date || "";
  deathDateInput.value = data.death_date || "";
  genderSelect.value   = data.gender     || "";
  regionInput.value    = data.region     || "";
  cityInput.value      = data.city       || "";
  messageInput.value   = data.message    || "";
  photoUrlInput.value  = data.photo_url  || "";
  videoInput.value     = data.youtube_url|| "";
  birthPlaceInput.value= data.birth_place|| "";
  professionInput.value= data.profession  || "";
  educationInput.value = data.education   || "";
  awardsInput.value    = data.awards      || "";
  interestsInput.value = data.interests   || "";
  cemeteryInput.value  = data.cemetery    || "";
  genealogyInput.value = data.genealogy   || "";

  // Φόρτωση σχέσεων στον πίνακα
  const { data: rels } = await supabase.from("relationships").select("*").eq("memorial_id",id);
  const tbody = document.querySelector("#relations-table tbody");
  tbody.innerHTML = "";
  if(!rels.length){
    tbody.innerHTML=`<tr id="noRelationshipsRow"><td colspan="2" style="text-align:center">Δεν υπάρχουν.</td></tr>`;
  } else {
    rels.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.relative_id}</td><td>${r.relation_type}</td>`;
      tbody.appendChild(tr);
    });
  }
  attachDeleteListeners();
}

// --------------------------------------------------
// 8. Form submit handler (create/update) + QR
// --------------------------------------------------
memorialForm?.addEventListener("submit",async e=>{
  e.preventDefault();
  // Έλεγχοι υποχρεωτικών
  if(!firstInput.value||!lastInput.value||!birthDateInput.value||!deathDateInput.value){
    return alert("Συμπλήρωσε όλα τα υποχρεωτικά πεδία.");
  }
  const today = new Date().toISOString().slice(0,10);
  if(deathDateInput.value>today){
    return alert("Η ημερομηνία θανάτου δεν μπορεί να είναι μελλοντική.");
  }

  let id = hiddenIdInput.value.trim()||null;
  const isNew = !id;
  if(isNew){
    const latinLast = toLatin(lastInput.value).toLowerCase().replace(/\s+/g,'');
    const citySlug  = toLatin(cityInput.value).toLowerCase().replace(/\s+/g,'');
    const { count } = await supabase
      .from("memorials")
      .select('*',{head:true,count:'exact'})
      .ilike('last_name', `%${latinLast}%`)
      .ilike('city',      `%${citySlug}%`);
    id = `${latinLast}${citySlug}A${(count||0)+1}`;
  }

  // Upsert
  await supabase.from("memorials").upsert({
    id,
    first_name:  firstInput.value,
    last_name:   lastInput.value,
    birth_date:  birthDateInput.value,
    death_date:  deathDateInput.value,
    gender:      genderSelect.value,
    region:      regionInput.value,
    city:        cityInput.value,
    message:     messageInput.value,
    photo_url:   photoUrlInput.value,
    youtube_url: videoInput.value,
    candles:     0,
    created_at:  new Date().toISOString(),
    birth_place: birthPlaceInput.value,
    profession:  professionInput.value,
    education:   educationInput.value,
    awards:      awardsInput.value,
    interests:   interestsInput.value,
    cemetery:    cemeteryInput.value,
    genealogy:   genealogyInput.value
  }, { onConflict:['id'] });

  // Δημιουργία/αποθήκευση QR
  const url = `${location.origin}/memorial.html?id=${id}`;
  if(isNew){
    const qrBlob = await (await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`
    )).blob();
    try {
      await supabase.storage.from("qr-codes").upload(`${id}.png`,qrBlob,{contentType:'image/png'});
    } catch(err){
      if(err.status!==409) console.error(err);
    }
  }
  const { data: pu } = supabase.storage.from("qr-codes").getPublicUrl(`${id}.png`);
  qrPreview.innerHTML = `
    <h3>QR Code</h3>
    <img src="${pu.publicUrl}" style="max-width:300px; border-radius:4px; margin-bottom:1rem;">
    <div><a href="${url}" target="_blank">${url}</a></div>
    <div style="margin-top:0.5rem;"><a href="${pu.publicUrl}" download="${id}.png">⬇️ Κατέβασε το QR</a></div>
  `;

  alert("✅ Καταχώρηση επιτυχής!");
  memorialForm.reset();
  hiddenIdInput.value="";
  document.querySelector("#relations-table tbody").innerHTML=`
    <tr id="noRelationshipsRow"><td colspan="2" style="text-align:center">Δεν υπάρχουν.</td></tr>
  `;
  attachDeleteListeners();
});

// --------------------------------------------------
// 9. Logout
// --------------------------------------------------
logoutBtn?.addEventListener("click",async()=>{
  await supabase.auth.signOut();
  window.location.href="/login.html";
});

// --------------------------------------------------
// 10. Init sections on load
// --------------------------------------------------
document.addEventListener("DOMContentLoaded",()=>{
  initBioSection();
  initAwardsSection();
  initInterestsSection();
  initBurialSection();
  initRelationships();    // <-- Εδώ καλούμε τις γενεαλογικές σχέσεις
  attachDeleteListeners();
});
