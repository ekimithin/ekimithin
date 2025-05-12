// js/admin.js
import { supabase } from "./supabase.js";
import { initBioSection }      from "./sections/biography.js";
import { initAwardsSection }   from "./sections/awards.js";
import { initInterestsSection} from "./sections/interests.js";
import { initBurialSection }   from "./sections/burial.js";
import { initRelationships }   from "./sections/relationships.js";

console.debug("[MODULE LOAD]", { module: "admin.js" });

/** Utility: Greek→Latin slug **/
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

// 1. Auth check
(async()=>{
  console.debug("[API CALL START]", { query:"auth.getSession" });
  const { data:{ session }, error } = await supabase.auth.getSession();
  console.debug("[API CALL RESULT]", { session, error });
  if(error||!session){
    console.warn("[AUTH FAIL] redirect to login");
    window.location.href="/login.html";
    return;
  }
  console.debug("[AUTH OK]", { user:session.user.email });
})();

// 2. DOM refs & warnings
const refs = {
  memorialForm:   document.getElementById("memorialForm"),
  memorialId:     document.getElementById("memorialId"),
  logoutBtn:      document.getElementById("logoutBtn"),
  qrPreview:      document.getElementById("qr-preview"),
  qrImage:        document.getElementById("qr-image"),
  firstname:      document.getElementById("firstname"),
  lastname:       document.getElementById("lastname"),
  birth_date:     document.getElementById("birth_date"),
  death_date:     document.getElementById("death_date"),
  gender:         document.getElementById("gender"),
  addressInput:   document.getElementById("addressInput"),
  suggestions:    document.getElementById("relativeResults"),
  map:            document.getElementById("map"),
  city:           document.getElementById("city"),
  region:         document.getElementById("region"),
  birth_place:    document.getElementById("birth_place"),
  profession:     document.getElementById("profession"),
  education:      document.getElementById("education"),
  awards:         document.getElementById("awards"),
  interests:      document.getElementById("interests"),
  cemetery:       document.getElementById("cemetery"),
  genealogy:      document.getElementById("genealogy"),
  relativeIdInput:document.getElementById("relativeIdInput"),
  relativeLastnameInput:document.getElementById("relativeLastnameInput"),
  relativeFirstnameInput:document.getElementById("relativeFirstnameInput"),
  relativeCityInput:document.getElementById("relativeCityInput"),
  relationType:   document.getElementById("relationType"),
  resultsContainer:document.getElementById("resultsContainer"),
  searchLastname: document.getElementById("searchLastname"),
  searchCity:     document.getElementById("searchCity"),
  relationsHeader:document.getElementById("relationsHeader")
};
for(const [k,el] of Object.entries(refs)){
  if(!el) console.warn("[DOM MISSING]",k);
  else    console.debug("[DOM FOUND]",k,el);
}

// 3. Leaflet init
const leafletMap = L.map("map").setView([37.9838,23.7275],6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19})
 .addTo(leafletMap);
const marker = L.marker([37.9838,23.7275]).addTo(leafletMap);
console.debug("[DOM UPDATE]",{selector:"#map",action:"initialized"});

// 4. Address autocomplete
let addrTimer;
refs.addressInput?.addEventListener("input",()=>{
  clearTimeout(addrTimer);
  const q=refs.addressInput.value.trim();
  if(q.length<3){
    refs.suggestions.innerHTML="";
    return;
  }
  addrTimer=setTimeout(async()=>{
    console.debug("[API CALL START]",{query:"nominatim",params:q});
    try{
      const res=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
      const places=await res.json();
      console.debug("[API CALL RESULT]",places.slice(0,5));
      refs.suggestions.innerHTML=places.slice(0,5).map(p=>
        `<li data-lat="${p.lat}" data-lon="${p.lon}">${p.display_name}</li>`
      ).join("");
    }catch(e){ console.error("[API ERROR]",e); }
  },300);
});
refs.suggestions?.addEventListener("click",e=>{
  if(e.target.tagName!=="LI")return;
  const {lat,lon}=e.target.dataset;
  const [city,region]=e.target.textContent.split(",").map(s=>s.trim());
  refs.city.value=city;
  refs.region.value=region;
  leafletMap.setView([lat,lon],14);
  marker.setLatLng([lat,lon]);
  refs.addressInput.value="";
  refs.suggestions.innerHTML="";
});

// 5. Live search memorials
let searchTimer;
async function searchMemorials(){
  clearTimeout(searchTimer);
  searchTimer=setTimeout(async()=>{
    const ln=refs.searchLastname.value.trim();
    const ct=refs.searchCity.value.trim();
    console.debug("[API CALL START]",{query:"memorials.search",params:{ln,ct}});
    let q=supabase.from("memorials").select("*").limit(10);
    if(ln) q=q.ilike("last_name",`%${ln}%`);
    if(ct) q=q.ilike("city",`%${ct}%`);
    const {data,error}=await q;
    console.debug("[API CALL RESULT]",{data,error});
    refs.resultsContainer.innerHTML="";
    if(error) { refs.resultsContainer.innerHTML="<p>σφάλμα</p>"; return; }
    if(!data.length){ refs.resultsContainer.innerHTML="<p>δεν βρέθηκαν</p>"; return; }
    data.forEach(ent=>{
      const div=document.createElement("div");
      div.style="border:1px solid #ccc;padding:0.8rem;border-radius:4px;margin-bottom:0.5rem";
      div.innerHTML=`
        <strong>${ent.first_name} ${ent.last_name}</strong><br/>
        <small>${ent.city}, ${ent.region}</small><br/>
        <button class="editBtn btn" data-id="${ent.id}">✏️</button>
        <button class="deleteBtn btn danger" data-id="${ent.id}">🗑️</button>
      `;
      refs.resultsContainer.append(div);
    });
    attachDeleteListeners();
    document.querySelectorAll(".editBtn")
      .forEach(b=>b.addEventListener("click",loadForEdit));
  },300);
}
[refs.searchLastname,refs.searchCity].forEach(el=>el?.addEventListener("input",searchMemorials));
refs.resultsContainer.innerHTML="<p>πληκτρολόγησε…</p>";

// 6. Delete helper
function attachDeleteListeners(){
  document.querySelectorAll(".deleteBtn").forEach(btn=>{
    btn.replaceWith(btn.cloneNode(true));
  });
  document.querySelectorAll(".deleteBtn").forEach(btn=>{
    btn.addEventListener("click",async()=>{
      console.debug("[EVENT] delete",btn.dataset.id);
      if(!confirm("θες σίγουρα;"))return;
      console.debug("[API CALL START] delete memorial",btn.dataset.id);
      await supabase.storage.from("qr-codes").remove([`${btn.dataset.id}.png`]);
      await supabase.from("relationships").delete().eq("memorial_id",btn.dataset.id);
      const {error}=await supabase.from("memorials").delete().eq("id",btn.dataset.id);
      console.debug("[API CALL RESULT]",error);
      if(error){ alert("σφάλμα"); return; }
      btn.closest("div").remove();
      alert("διαγράφηκε");
    });
  });
}

// 7. Load for edit
async function loadForEdit(){
  const id=this.dataset.id;
  console.debug("[EVENT] edit",id);
  const {data,error}=await supabase.from("memorials")
    .select("*").eq("id",id).single();
  console.debug("[API CALL RESULT]",{data,error});
  if(error||!data){ alert("δεν βρέθηκε"); return; }

  // populate
  refs.memorialId.value   = data.id;
  refs.firstname.value    = data.first_name;
  refs.lastname.value     = data.last_name;
  refs.birth_date.value   = data.birth_date  || "";
  refs.death_date.value   = data.death_date  || "";
  refs.gender.value       = data.gender      || "";
  refs.city.value         = data.city        || "";
  refs.region.value       = data.region      || "";
  refs.message.value      = data.message     || "";
  refs.photoUrl.value     = data.photo_url   || "";
  refs.video.value        = data.youtube_url || "";
  refs.birth_place.value  = data.birth_place || "";
  refs.profession.value   = data.profession  || "";
  refs.education.value    = data.education   || "";
  refs.awards.value       = data.awards      || "";
  refs.interests.value    = data.interests   || "";
  refs.cemetery.value     = data.cemetery    || "";
  refs.genealogy.value    = data.genealogy   || "";
  console.debug("[DOM UPDATE] form populated");

  // header
  refs.relationsHeader.textContent = `${data.first_name} ${data.last_name} — Σχέσεις`;

  // load relationships
  const {data:rels, error:relErr}=await supabase
    .from("relationships").select("*").eq("memorial_id",id);
  console.debug("[API CALL RESULT]",{rels,relErr});
  const tbody=document.querySelector("#relations-table tbody");
  tbody.innerHTML="";
  if(!rels.length){
    tbody.innerHTML=`<tr id="noRelationshipsRow">
      <td colspan="2" style="text-align:center">Δεν υπάρχουν.</td>
    </tr>`;
  } else {
    rels.forEach(r=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${r.relative_id}</td><td>${r.relation_type}</td>`;
      tbody.append(tr);
    });
  }
  attachDeleteListeners();
}

// 8. Submit handler
refs.memorialForm?.addEventListener("submit",async e=>{
  e.preventDefault();
  console.debug("[EVENT] submit",{
    firstname:refs.firstname.value,
    lastname: refs.lastname.value,
    birth_date:refs.birth_date.value,
    death_date:refs.death_date.value
  });

  // validation
  const bd=refs.birth_date.value, dd=refs.death_date.value;
  const today=(new Date()).toISOString().slice(0,10);
  if(!refs.firstname.value||!refs.lastname.value||!bd||!dd){
    console.warn("[VALIDATION FAIL] missing");
    return alert("συμπλήρωσε όλα τα απαραίτητα");
  }
  if(bd>dd){
    console.warn("[VALIDATION FAIL] bd>dd");
    return alert("γεννηση μετά θάνατο;");
  }
  if(dd>today){
    console.warn("[VALIDATION FAIL] deathDate>today");
    return alert("ημ. θανάτου μεγαλύτερη από σήμερα");
  }

  // determine ID
  let id=refs.memorialId.value.trim()||null;
  const isNew=!id;
  const rawLast=refs.lastname.value.trim(), rawCity=refs.city.value.trim();
  if(isNew){
    const latinLast=toLatin(rawLast).toLowerCase().replace(/\s+/g,''), citySlug=toLatin(rawCity).toLowerCase().replace(/\s+/g,'');
    const {count}=await supabase
      .from("memorials").select('*',{head:true,count:'exact'})
      .ilike('last_name',`%${latinLast}%`)
      .ilike('city',`%${citySlug}%`);
    id=`${latinLast}${citySlug}A${(count||0)+1}`;
    console.debug("[ID GEN]",id);
  }

  // upsert
  console.debug("[API CALL START] upsert",id);
  const {error:upErr}=await supabase.from("memorials").upsert({
    id,
    first_name:refs.firstname.value,
    last_name: refs.lastname.value,
    birth_date: bd,
    death_date: dd,
    gender: refs.gender.value,
    region: refs.region.value,
    city: refs.city.value,
    message: refs.message.value,
    photo_url: refs.photoUrl.value,
    youtube_url:refs.video.value,
    candles:0,
    created_at:new Date().toISOString(),
    birth_place:refs.birth_place.value,
    profession:refs.profession.value,
    education:refs.education.value,
    awards:refs.awards.value,
    interests:refs.interests.value,
    cemetery:refs.cemetery.value,
    genealogy:refs.genealogy.value
  },{onConflict:['id']});
  console.debug("[API CALL RESULT]",upErr);
  if(upErr){ console.error(upErr); return alert("σφάλμα αποθήκευσης"); }

  // relationships refresh
  await supabase.from("relationships").delete().eq("memorial_id",id);
  const rows=Array.from(document.querySelectorAll("#relations-table tbody tr"))
    .filter(tr=>tr.id!=="noRelationshipsRow");
  if(rows.length){
    const toIns=rows.map(tr=>({
      memorial_id:id,
      relative_id:tr.children[0].textContent.trim(),
      relation_type:tr.children[1].textContent.trim()
    }));
    await supabase.from("relationships").insert(toIns);
  }

  // QR on new
  if(isNew){
    const url=`${location.origin}/memorial.html?id=${id}`;
    const blob=await (await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`)).blob();
    await supabase.storage.from("qr-codes").upload(`${id}.png`,blob,{contentType:"image/png"});
  }

  // show QR
  const { data:pu } = supabase.storage.from("qr-codes").getPublicUrl(`${id}.png`);
  refs.qrImage.src=pu.publicUrl;
  refs.qrImage.style.display="block";
  refs.qrPreview.querySelector("h3").textContent=`QR Code για ${refs.firstname.value} ${refs.lastname.value}`;
  console.debug("[DOM UPDATE] QR preview");

  alert("✅ Επιτυχής καταχώρηση!");
  refs.memorialForm.reset();
  refs.memorialId.value="";
  refs.relationsHeader.textContent="Σχέσεις";
  document.querySelector("#relations-table tbody").innerHTML=`
    <tr id="noRelationshipsRow"><td colspan="2" style="text-align:center">Δεν υπάρχουν.</td></tr>
  `;
  attachDeleteListeners();
});

// 9. Logout
refs.logoutBtn?.addEventListener("click",async()=>{
  console.debug("[EVENT] logout");
  const {error}=await supabase.auth.signOut();
  if(error){ console.error(error); alert("σφάλμα logout"); return; }
  window.location.href="/login.html";
});

// 10. Init on load
document.addEventListener("DOMContentLoaded",()=>{
  console.debug("[DOC READY] init sections");
  initBioSection();
  initAwardsSection();
  initInterestsSection();
  initBurialSection();
  initRelationships();
  attachDeleteListeners();
});
