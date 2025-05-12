// js/admin.js
import { supabase } from "./supabase.js";
import { initBioSection }    from "./sections/biography.js";
import { initAwardsSection } from "./sections/awards.js";
import { initInterestsSection } from "./sections/interests.js";
import { initBurialSection } from "./sections/burial.js";
import { initRelationships } from "./sections/relationships.js";

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
  return text.split('').map(c=>map[c]||c).join('');
}

console.debug("[MODULE]", "admin.js loaded");

// --- AUTH CHECK ------------------------------------------------
(async()=>{
  console.debug("[API CALL START]", "getSession");
  const { data:{session}, error } = await supabase.auth.getSession();
  console.debug("[API CALL RESULT]", { session, error });
  if (error || !session) {
    console.warn("[AUTH]", "no session → redirect to login");
    return window.location.href="/login.html";
  }
  console.debug("[AUTH]", "user:", session.user.email);
})();

// --- DOM REFERENCES -------------------------------------------
const refs = {
  memorialForm:        document.getElementById("memorialForm"),
  hiddenIdInput:       document.getElementById("memorialId"),
  logoutBtn:           document.getElementById("logoutBtn"),
  qrPreview:           document.getElementById("qr-preview"),
  qrImage:             document.getElementById("qr-image"),
  firstname:           document.getElementById("firstname"),
  lastname:            document.getElementById("lastname"),
  birthDate:           document.getElementById("birth_date"),
  deathDate:           document.getElementById("death_date"),
  gender:              document.getElementById("gender"),
  addressInput:        document.getElementById("addressInput"),
  addressSuggestions:  document.getElementById("addressSuggestions"),
  city:                document.getElementById("city"),
  region:              document.getElementById("region"),
  birthPlace:          document.getElementById("birth_place"),
  profession:          document.getElementById("profession"),
  education:           document.getElementById("education"),
  awards:              document.getElementById("awards"),
  interests:           document.getElementById("interests"),
  cemetery:            document.getElementById("cemetery"),
  relativeIdInput:     document.getElementById("relativeIdInput"),
  relativeLastnameInput: document.getElementById("relativeLastnameInput"),
  relativeFirstnameInput: document.getElementById("relativeFirstnameInput"),
  relativeCityInput:   document.getElementById("relativeCityInput"),
  relativeResults:     document.getElementById("relativeResults"),
  relationType:        document.getElementById("relationType"),
  relationsTable:      document.getElementById("relations-table"),
  relationsHeader:     document.getElementById("relationsHeader"),
  noRelationshipsRow:  document.getElementById("noRelationshipsRow"),
  message:             document.getElementById("message"),
  photoUrl:            document.getElementById("photoUrl"),
  video:               document.getElementById("video"),
  searchLastname:      document.getElementById("searchLastname"),
  searchCity:          document.getElementById("searchCity"),
  resultsContainer:    document.getElementById("resultsContainer")
};
for (const [k,el] of Object.entries(refs)) {
  if (!el) console.warn("[DOM MISSING]", k);
  else     console.debug("[DOM]", k, el);
}

// --- Leaflet Map Setup ---------------------------------------
console.debug("[MODULE]", "leaflet-map init");
const map = L.map("map").setView([37.9838,23.7275],6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);
const marker = L.marker([37.9838,23.7275]).addTo(map);

// --- Address Autocomplete ------------------------------------
let addrTimer;
refs.addressInput?.addEventListener("input",()=>{
  clearTimeout(addrTimer);
  const q = refs.addressInput.value.trim();
  if (q.length<3) {
    refs.addressSuggestions.innerHTML="";
    return;
  }
  addrTimer=setTimeout(async()=>{
    console.debug("[API CALL START]", "nominatim", q);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      console.debug("[API CALL RESULT]", data.slice(0,5));
      refs.addressSuggestions.innerHTML = data.slice(0,5)
        .map(p=>`<li data-lat="${p.lat}" data-lon="${p.lon}">${p.display_name}</li>`)
        .join("");
    } catch(err){
      console.error("[API ERROR]", err);
    }
  },300);
});
refs.addressSuggestions?.addEventListener("click",e=>{
  if (e.target.tagName!=="LI") return;
  const { lat, lon } = e.target.dataset;
  console.debug("[EVENT]", "select address", e.target.textContent);
  const [city, region] = e.target.textContent.split(",").map(s=>s.trim());
  refs.city.value = city; refs.region.value = region;
  map.setView([lat,lon],14); marker.setLatLng([lat,lon]);
  refs.addressInput.value = ""; refs.addressSuggestions.innerHTML="";
});

// --- Live Search Memorials -----------------------------------
let searchTimer;
async function searchMemorials(){
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async()=>{
    const ln=refs.searchLastname.value.trim(), ct=refs.searchCity.value.trim();
    console.debug("[API CALL START]", "search memorials", {ln,ct});
    let q = supabase.from("memorials").select("*").limit(10);
    if(ln) q=q.ilike("last_name",`%${ln}%`);
    if(ct) q=q.ilike("city",`%${ct}%`);
    const { data, error } = await q;
    console.debug("[API CALL RESULT]", {data,error});
    refs.resultsContainer.innerHTML = "";
    if(error) return refs.resultsContainer.innerHTML="<p>Σφάλμα.</p>";
    if(!data.length) return refs.resultsContainer.innerHTML="<p>Δεν βρέθηκαν.</p>";
    for(const entry of data){
      const div=document.createElement("div");
      div.style="border:1px solid #ccc;padding:1rem;margin-bottom:1rem;border-radius:5px";
      div.innerHTML=`
        <strong>${entry.first_name} ${entry.last_name}</strong><br>
        <small>${entry.city}, ${entry.region}</small><br>
        <button class="editBtn" data-id="${entry.id}">✏️</button>
        <button class="deleteBtn" data-id="${entry.id}">🗑️</button>
      `;
      refs.resultsContainer.append(div);
    }
    attachDeleteListeners();
    document.querySelectorAll(".editBtn").forEach(btn=>btn.addEventListener("click",loadForEdit));
  },300);
}
refs.searchLastname?.addEventListener("input",searchMemorials);
refs.searchCity?.addEventListener("input",searchMemorials);
refs.resultsContainer.innerHTML="<p>Πληκτρολόγησε για αναζήτηση…</p>";

// --- Delete Helper ------------------------------------------
function attachDeleteListeners(){
  document.querySelectorAll(".deleteBtn").forEach(b=>{
    b.replaceWith(b.cloneNode(true));
  });
  document.querySelectorAll(".deleteBtn").forEach(btn=>{
    btn.addEventListener("click",async()=>{
      const id=btn.dataset.id;
      console.debug("[EVENT]", "delete", id);
      if(!confirm("Σίγουρα διαγραφή;")) return;
      console.debug("[API CALL START]", "delete memorial",id);
      await supabase.storage.from("qr-codes").remove([`${id}.png`]);
      await supabase.from("relationships").delete().eq("memorial_id",id);
      const { error }=await supabase.from("memorials").delete().eq("id",id);
      console.debug("[API CALL RESULT]", error);
      if(error){ alert("Σφάλμα"); console.error(error); }
      else{ btn.closest("div").remove(); alert("Διαγράφηκε"); }
    });
  });
}

// --- Load for Edit ------------------------------------------
async function loadForEdit(){
  const id=this.dataset.id;
  console.debug("[EVENT]", "edit", id);
  console.debug("[API CALL START]", "get memorial",id);
  const { data, error }=await supabase.from("memorials").select("*").eq("id",id).single();
  console.debug("[API CALL RESULT]", {data,error});
  if(error||!data){ alert("Δεν βρέθηκε"); return; }

  // populate fields
  refs.hiddenIdInput.value       = data.id;
  refs.firstname.value           = data.first_name;
  refs.lastname.value            = data.last_name;
  refs.birthDate.value           = data.birth_date || "";
  refs.deathDate.value           = data.death_date || "";
  refs.gender.value              = data.gender || "";
  refs.city.value                = data.city || "";
  refs.region.value              = data.region || "";
  refs.message.value             = data.message || "";
  refs.photoUrl.value            = data.photo_url || "";
  refs.video.value               = data.youtube_url || "";
  refs.birthPlace.value          = data.birth_place || "";
  refs.profession.value          = data.profession || "";
  refs.education.value           = data.education || "";
  refs.awards.value              = data.awards || "";
  refs.interests.value           = data.interests || "";
  refs.cemetery.value            = data.cemetery || "";
  console.debug("[POPULATE]", "form fields populated");

  // load relationships
  console.debug("[API CALL START]", "get relationships",id);
  const { data:rels }=await supabase.from("relationships").select("*").eq("memorial_id",id);
  console.debug("[API CALL RESULT]", rels);
  const tbody=refs.relationsTable.querySelector("tbody");
  tbody.innerHTML="";
  if(!rels.length){
    refs.noRelationshipsRow.style.display="";
  } else {
    refs.noRelationshipsRow.style.display="none";
    rels.forEach(r=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${r.relative_id}</td><td>${r.relation_type}</td><td><button class="deleteBtn">🗑️</button></td>`;
      tbody.append(tr);
      tr.querySelector(".deleteBtn").addEventListener("click",()=>tr.remove());
    });
  }
  attachDeleteListeners();
}

// --- Submit Handler ----------------------------------------
refs.memorialForm?.addEventListener("submit",async e=>{
  e.preventDefault();
  console.debug("[EVENT]", "submit form");

  // validation
  const fn=refs.firstname.value.trim();
  const ln=refs.lastname.value.trim();
  const bd=refs.birthDate.value;
  const dd=refs.deathDate.value;
  if(!fn||!ln||!bd||!dd){
    console.warn("[VALIDATION FAIL]", "missing fields");
    return alert("Συμπλήρωσε Όνομα, Επώνυμο, Γέννηση & Θάνατο.");
  }
  const deathDay=new Date(dd), today=new Date();
  if(deathDay>today){
    console.warn("[VALIDATION FAIL]", "deathDate > today");
    return alert("Η ημερομηνία θανάτου δεν μπορεί να είναι στο μέλλον.");
  }

  // determine ID
  let id=refs.hiddenIdInput.value.trim();
  const isNew=!id;
  if(isNew){
    const slugLast=toLatin(ln).toLowerCase().replace(/\s+/g,"");
    const slugCity=toLatin(refs.city.value.trim()).toLowerCase().replace(/\s+/g,"");
    console.debug("[SLUG]", {slugLast,slugCity});
    const { count }=await supabase.from("memorials").select("*",{head:true,count:"exact"})
      .ilike("last_name",slugLast).ilike("city",slugCity);
    id=`${slugLast}${slugCity}A${(count||0)+1}`;
    console.debug("[ID]", id);
  }

  // upsert memorial
  console.debug("[API CALL START]", "upsert memorial");
  const { error:upErr }=await supabase.from("memorials").upsert({
    id,
    first_name:fn,
    last_name:ln,
    birth_date:bd,
    death_date:dd,
    gender:refs.gender.value,
    city:refs.city.value,
    region:refs.region.value,
    message:refs.message.value,
    photo_url:refs.photoUrl.value,
    youtube_url:refs.video.value,
    candles:0,
    created_at:new Date().toISOString(),
    birth_place:refs.birthPlace.value,
    profession:refs.profession.value,
    education:refs.education.value,
    awards:refs.awards.value,
    interests:refs.interests.value,
    cemetery:refs.cemetery.value
  },{ onConflict:["id"] });
  console.debug("[API CALL RESULT]", upErr);
  if(upErr){ alert("Σφάλμα"); console.error(upErr); return; }

  // relationships refresh
  console.debug("[RELATIONS]", "refresh");
  await supabase.from("relationships").delete().eq("memorial_id",id);
  const rows=Array.from(refs.relationsTable.querySelectorAll("tbody tr"))
    .filter(tr=>tr.id!=="noRelationshipsRow");
  if(rows.length){
    const toInsert=rows.map(tr=>({
      memorial_id:id,
      relative_id:tr.children[0].textContent.trim(),
      relation_type:tr.children[1].textContent.trim()
    }));
    console.debug("[API CALL START]", "insert relations",toInsert);
    await supabase.from("relationships").insert(toInsert);
  }

  // QR code (new only)
  if(isNew){
    const url=`${location.origin}/memorial.html?id=${id}`;
    console.debug("[API CALL START]", "fetch QR",url);
    const blob=await (await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`
    )).blob();
    console.debug("[API CALL]", "upload QR");
    await supabase.storage.from("qr-codes").upload(`${id}.png`,blob,{contentType:"image/png"});
  }

  // show QR
  console.debug("[API CALL]", "getPublicUrl");
  const { data:pu }=supabase.storage.from("qr-codes").getPublicUrl(`${id}.png`);
  refs.qrImage.src=pu.publicUrl; refs.qrImage.style.display="block";
  refs.qrPreview.querySelector("h3").textContent=`QR Code για ${fn} ${ln}`;
  console.debug("[DOM]", "QR preview updated");

  alert("✅ Καταχωρήθηκε!");
  refs.memorialForm.reset();
  refs.hiddenIdInput.value="";
  refs.relationsTable.querySelector("tbody").innerHTML=
    `<tr id="noRelationshipsRow"><td colspan="2" style="text-align:center">Δεν υπάρχουν.</td></tr>`;
  attachDeleteListeners();
});

// --- Logout --------------------------------------------------
refs.logoutBtn?.addEventListener("click",async()=>{
  console.debug("[EVENT]", "logout click");
  const { error }=await supabase.auth.signOut();
  if(error){ alert("Σφάλμα logout"); console.error(error); return;}
  window.location.href="/login.html";
});

// --- Init Sections -----------------------------------------
document.addEventListener("DOMContentLoaded",()=>{
  console.debug("[DOC]", "init sections");
  initBioSection();
  initAwardsSection();
  initInterestsSection();
  initBurialSection();
  initRelationships();
  attachDeleteListeners();
});
