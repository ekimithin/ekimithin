// js/admin.js

import { supabase } from "./supabase.js";
import { initBioSection }    from "./sections/biography.js";
import { initAwardsSection } from "./sections/awards.js";
import { initInterestsSection } from "./sections/interests.js";
import { initBurialSection } from "./sections/burial.js";
import "./sections/relationships.js"; // χειρίζεται UI & listeners για τις σχέσεις

// Utility: Greek → Latin
function toLatin(text) {
  const map = { 'ά':'a','Ά':'A','έ':'e','Έ':'E','ή':'i','Ή':'I','ί':'i','Ί':'I',
    'ό':'o','Ό':'O','ώ':'o','Ώ':'O','ύ':'y','Ύ':'Y','ϋ':'y','Ϋ':'Y',
    'α':'a','Α':'A','β':'b','Β':'B','γ':'g','Γ':'G','δ':'d','Δ':'D',
    'ε':'e','Ε':'E','ζ':'z','Ζ':'Z','η':'i','Η':'I','θ':'th','Θ':'Th',
    'ι':'i','Ι':'I','κ':'k','Κ':'K','λ':'l','Λ':'L','μ':'m','Μ':'M',
    'ν':'n','Ν':'N','ξ':'x','Ξ':'X','ο':'o','Ο':'O','π':'p','Π':'P',
    'ρ':'r','Ρ':'R','σ':'s','Σ':'S','ς':'s','τ':'t','υ':'y','Υ':'Y',
    'φ':'f','Φ':'F','χ':'ch','Χ':'Ch','ψ':'ps','Ψ':'Ps','ω':'o','Ω':'O'
  };
  return text.split('').map(c => map[c]||c).join('');
}

// DOM elements
const memorialForm   = document.getElementById("memorialForm");
const hiddenIdInput  = document.getElementById("memorialId");
const logoutBtn      = document.getElementById("logoutBtn");
const qrPreview      = document.getElementById("qr-preview");

const firstInput     = document.getElementById("firstname");
const lastInput      = document.getElementById("lastname");
const birthDateInput = document.getElementById("birth_date");
const deathDateInput = document.getElementById("death_date");
const genderSelect   = document.getElementById("gender");
const regionInput    = document.getElementById("region");
const cityInput      = document.getElementById("city");
const messageInput   = document.getElementById("message");
const photoUrlInput  = document.getElementById("photoUrl");
const videoInput     = document.getElementById("video");

const birthPlaceInput = document.getElementById("birth_place");
const professionInput = document.getElementById("profession");
const educationInput  = document.getElementById("education");
const awardsInput     = document.getElementById("awards");
const interestsInput  = document.getElementById("interests");
const cemeteryInput   = document.getElementById("cemetery");
const genealogyInput  = document.getElementById("genealogy");

const addrIn    = document.getElementById("addressInput");
const suggList  = document.getElementById("suggestions");

// Leaflet map setup
const map    = L.map("map").setView([37.9838, 23.7275], 6);
const marker = L.marker([37.9838, 23.7275]).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:19 }).addTo(map);

// Autocomplete
let addrTimer;
addrIn.addEventListener("input", () => {
  clearTimeout(addrTimer);
  const q = addrIn.value.trim();
  if (q.length < 3) { suggList.innerHTML=""; return; }
  addrTimer = setTimeout(async () => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
      const places = await res.json();
      suggList.innerHTML = places.slice(0,5).map(p =>
        `<li data-lat="${p.lat}" data-lon="${p.lon}">${p.display_name}</li>`
      ).join("");
    } catch(e){ console.error(e); }
  },300);
});
suggList.addEventListener("click", e => {
  if (e.target.tagName!=="LI") return;
  const {lat,lon} = e.target.dataset;
  const parts = e.target.textContent.split(",");
  regionInput.value = parts[1]?.trim()||"";
  cityInput.value   = parts[0]?.trim()||"";
  map.setView([lat,lon],14);
  marker.setLatLng([lat,lon]);
  addrIn.value=""; suggList.innerHTML="";
});

// Delete helper
function attachDeleteListeners(){
  document.querySelectorAll(".deleteBtn").forEach(btn=>{
    btn.replaceWith(btn.cloneNode(true));
  });
  document.querySelectorAll(".deleteBtn").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.id;
      if(!confirm("Διαγραφή;")) return;
      await supabase.storage.from("qr-codes").remove([`${id}.png`]);
      await supabase.from("relationships").delete().eq("memorial_id",id);
      const { error } = await supabase.from("memorials").delete().eq("id",id);
      if(error) return alert("Σφάλμα διαγραφής.");
      btn.closest("div").remove();
      alert("Διαγράφηκε.");
    });
  });
}

// Live search
const searchLastname   = document.getElementById("searchLastname");
const searchCity       = document.getElementById("searchCity");
const resultsContainer = document.getElementById("resultsContainer");
let searchTimer;

async function searchMemorials(){
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async ()=>{
    const ln = searchLastname.value.trim();
    const ct = searchCity.value.trim();
    let q = supabase.from("memorials").select("*").limit(10);
    if(ln) q = q.ilike("last_name",`%${ln}%`);
    if(ct) q = q.ilike("city",`%${ct}%`);
    const { data, error } = await q;
    resultsContainer.innerHTML="";
    if(error) return resultsContainer.innerHTML="<p>Σφάλμα.</p>";
    if(!data.length) return resultsContainer.innerHTML="<p>Δεν βρέθηκαν.</p>";
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
[searchLastname,searchCity].forEach(el=>el.addEventListener("input",searchMemorials));
resultsContainer.innerHTML="<p>Πληκτρολόγησε για αναζήτηση…</p>";

// Load for edit
async function loadForEdit(){
  const id = this.dataset.id;
  const { data, error } = await supabase.from("memorials").select("*").eq("id",id).single();
  if(error||!data) return alert("Δεν βρέθηκε.");
  hiddenIdInput.value = data.id;
  firstInput.value   = data.first_name;
  lastInput.value    = data.last_name;
  birthDateInput.value = data.birth_date||"";
  deathDateInput.value = data.death_date||"";
  genderSelect.value = data.gender||"";
  regionInput.value  = data.region||"";
  cityInput.value    = data.city||"";
  messageInput.value = data.message||"";
  photoUrlInput.value= data.photo_url||"";
  videoInput.value   = data.youtube_url||"";
  birthPlaceInput.value= data.birth_place||"";
  professionInput.value= data.profession||"";
  educationInput.value = data.education||"";
  awardsInput.value    = data.awards||"";
  interestsInput.value = data.interests||"";
  cemeteryInput.value  = data.cemetery||"";
  genealogyInput.value = data.genealogy||"";

  const { data: rels } = await supabase.from("relationships").select("*").eq("memorial_id",id);
  const tbody = document.querySelector("#relationshipsTable tbody");
  tbody.innerHTML = "";
  if(!rels.length){
    tbody.innerHTML=`<tr id="noRelationshipsRow"><td colspan="2" style="text-align:center">Δεν υπάρχουν.</td></tr>`;
  } else {
    rels.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML=`<td>${r.relative_first_name} ${r.relative_last_name}</td><td>${r.relation_type}</td>`;
      tbody.appendChild(tr);
    });
  }
  attachDeleteListeners();
}

// Submit handler
memorialForm.addEventListener("submit", async e=>{
  e.preventDefault();
  const rawFirst = firstInput.value.trim();
  const rawLast  = lastInput.value.trim();
  const rawCity  = cityInput.value.trim();
  if(!rawFirst||!rawLast||!rawCity){
    return alert("Συμπλήρωσε Όνομα, Επώνυμο, Πόλη.");
  }
  const birthDate = birthDateInput.value||null;
  const deathDate = deathDateInput.value||null;
  if(birthDate&&deathDate&&new Date(birthDate)>new Date(deathDate)){
    return alert("Η γέννηση μετά τον θάνατο;");
  }

  const existingId = hiddenIdInput.value.trim();
  let id, isNew;
  if(existingId){
    id = existingId; isNew = false;
  } else {
    isNew = true;
    const latinLast = toLatin(rawLast).toLowerCase();
    const citySlug = toLatin(rawCity).toLowerCase();
    const { count } = await supabase.from("memorials").select("*",{head:true,count:"exact"})
      .ilike("last_name",latinLast).ilike("city",citySlug);
    id = `${latinLast}${citySlug}A${(count||0)+1}`.replace(/\s+/g,'');
  }

  // Upsert memorial
  const { error: upErr } = await supabase.from("memorials").upsert({
    id,
    first_name: rawFirst,
    last_name: toLatin(rawLast).toLowerCase(),
    birth_date: birthDate,
    death_date: deathDate,
    gender: genderSelect.value,
    region: regionInput.value.trim(),
    city: rawCity,
    message: messageInput.value.trim(),
    photo_url: photoUrlInput.value.trim(),
    youtube_url: videoInput.value.trim(),
    candles: 0,
    created_at: new Date().toISOString(),
    birth_place: birthPlaceInput.value.trim(),
    profession: professionInput.value.trim(),
    education: educationInput.value.trim(),
    awards: awardsInput.value.trim(),
    interests: interestsInput.value.trim(),
    cemetery: cemeteryInput.value.trim(),
    genealogy: genealogyInput.value.trim()
  }, { onConflict:['id'] });
  if(upErr){ console.error(upErr); return alert("Σφάλμα αποθήκευσης."); }

  // Relationships
  await supabase.from("relationships").delete().eq("memorial_id",id);
  const relRows = Array.from(document.querySelectorAll("#relationshipsTable tbody tr"));
  if(relRows.length && relRows[0].id!=="noRelationshipsRow"){
    const toInsert = relRows.map(tr=>({
      memorial_id:id,
      relative_id:tr.children[0].dataset.id,
      relation_type:tr.children[1].textContent.trim()
    }));
    await supabase.from("relationships").insert(toInsert);
  }

  // QR only on new
  if(isNew){
    const url = `${location.origin}/memorial.html?id=${id}`;
    const qrBlob = await (await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`
    )).blob();
    await supabase.storage.from("qr-codes").upload(`${id}.png`,qrBlob,{contentType:"image/png"});
  }

  // Show QR
  const { data: pu } = supabase.storage.from("qr-codes").getPublicUrl(`${id}.png`);
  qrPreview.innerHTML = `
    <img src="${pu.publicUrl}" style="max-width:300px;margin-bottom:1rem;">
    <div><a href="${location.origin}/memorial.html?id=${id}" target="_blank">${location.origin}/memorial.html?id=${id}</a></div>
    <a href="${pu.publicUrl}" download="${id}.png">⬇️ Κατέβασε το QR</a>
  `;
  alert("Καταχωρήθηκε!");

  // Reset
  memorialForm.reset();
  hiddenIdInput.value="";
  document.querySelector("#relationshipsTable tbody").innerHTML = `
    <tr id="noRelationshipsRow"><td colspan="2" style="text-align:center">Δεν υπάρχουν.</td></tr>
  `;
  attachDeleteListeners();
});

// Logout
logoutBtn.addEventListener("click", async ()=>{
  await supabase.auth.signOut();
  window.location.href="/login.html";
});

// Init sections
document.addEventListener("DOMContentLoaded", ()=>{
  initBioSection();
  initAwardsSection();
  initInterestsSection();
  initBurialSection();
  attachDeleteListeners();
});
