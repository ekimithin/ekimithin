// js/admin.js
import { supabase } from "./supabase.js";

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
  return text.split('').map(c => latinMap[c]||c).join('');
}

// ================= Redirect αν δεν είσαι συνδεδεμένος =================
(async () => {
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session) window.location.href = "/login.html";
})();

// ================= Elements =================
const form         = document.getElementById("memorialForm");
const logoutBtn    = document.getElementById("logoutBtn");
const qrPreview    = document.getElementById("qr-preview");
const qrImage      = document.getElementById("qr-image");

// --- address autocomplete & map ---
const addrIn    = document.getElementById("addressInput");
const suggList  = document.getElementById("suggestions");
let addrTimer;

addrIn.addEventListener("input", () => {
  clearTimeout(addrTimer);
  const q = addrIn.value.trim();
  if (q.length < 3) { suggList.innerHTML = ""; return; }
  addrTimer = setTimeout(async () => {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
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

// Leaflet initialization
const map = L.map("map").setView([37.9838,23.7275],6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{ maxZoom:19 }).addTo(map);
const marker = L.marker([37.9838,23.7275]).addTo(map);

// --- relationship search ---
const inpId   = document.getElementById("relativeIdInput");
const inpLn   = document.getElementById("relativeLastnameInput");
const inpFn   = document.getElementById("relativeFirstnameInput");
const inpCity = document.getElementById("relativeCityInput");
const relRes  = document.getElementById("relativeResults");
let selRelId = null, relTimer;

function buildOrClauses(){
  const c = [];
  if(inpId.value.trim())   c.push(`id.ilike.*${inpId.value.trim()}*`);
  if(inpLn.value.trim())   c.push(`last_name.ilike.*${inpLn.value.trim()}*`);
  if(inpFn.value.trim())   c.push(`first_name.ilike.*${inpFn.value.trim()}*`);
  if(inpCity.value.trim()) c.push(`city.ilike.*${inpCity.value.trim()}*`);
  return c.join(",");
}

[inpId,inpLn,inpFn,inpCity].forEach(inp => {
  inp.addEventListener("input", () => {
    clearTimeout(relTimer);
    relRes.innerHTML = "";
    relTimer = setTimeout(async () => {
      const orq = buildOrClauses();
      if(!orq) return;
      const { data } = await supabase
        .from("memorials")
        .select("id,first_name,last_name,city")
        .or(orq)
        .limit(10);
      relRes.innerHTML = data.map(r =>
        `<li data-id="${r.id}">${r.id} — ${r.first_name} ${r.last_name} (${r.city})</li>`
      ).join("");
    }, 300);
  });
});

relRes.addEventListener("click", e => {
  if(e.target.tagName !== "LI") return;
  selRelId = e.target.dataset.id;
  Array.from(relRes.children).forEach(li => li.classList.remove("selected"));
  e.target.classList.add("selected");
});

// --- manage relationships table & genealogy ---
const addRelBtn      = document.getElementById("addRelationshipBtn");
const relTableBody   = document.querySelector("#relationshipsTable tbody");
const genealogyTa    = document.getElementById("genealogy");

addRelBtn.addEventListener("click", () => {
  const relType = document.getElementById("relationType").value;
  if(!selRelId || !relType) {
    return alert("Επίλεξε εγγραφή και τύπο σχέσης");
  }
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${relType}</td>
    <td>${selRelId}</td>
    <td><button class="delRel">❌</button></td>
  `;
  relTableBody.appendChild(tr);
  updateGenealogy();
  // reset
  selRelId = null;
  relRes.innerHTML = "";
  [inpId,inpLn,inpFn,inpCity].forEach(i=>i.value="");
});

relTableBody.addEventListener("click", e => {
  if(!e.target.matches(".delRel")) return;
  e.target.closest("tr").remove();
  updateGenealogy();
});

function updateGenealogy(){
  const lines = [];
  relTableBody.querySelectorAll("tr").forEach(tr => {
    const type = tr.children[0].textContent;
    const id   = tr.children[1].textContent;
    lines.push(`${type}: ${id}`);
  });
  genealogyTa.value = lines.join("; ");
}

// ================= Attach delete-buttons listener ================
function attachDeleteListeners(){
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.replaceWith(btn.cloneNode(true));
  });
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if(!confirm("Θες σίγουρα να διαγράψεις αυτό το memorial;")) return;

      // remove QR from storage
      const { error: remErr } = await supabase
        .storage
        .from("qr-codes")
        .remove([`${id}.png`]);
      if(remErr) console.warn("❌ QR remove failed:", remErr);

      // delete relationships
      const { error: relErr } = await supabase
        .from("relationships")
        .delete()
        .eq("memorial_id", id);
      if(relErr) console.warn("❌ rel delete failed:", relErr);

      // delete memorial
      const { error: memErr } = await supabase
        .from("memorials")
        .delete()
        .eq("id", id);
      if(memErr) {
        return alert("❌ Σφάλμα στη διαγραφή.");
      }

      btn.closest("div").remove();
      alert("✅ Διαγράφηκε memorial, σχέσεις & QR.");
    });
  });
}

// ================= Search existing memorials =================
const searchForm = document.getElementById("searchForm");
const resultsContainer = document.getElementById("resultsContainer");

searchForm.addEventListener("submit", async e => {
  e.preventDefault();
  const ln = document.getElementById("searchLastname").value.trim().toLowerCase();
  const ct = document.getElementById("searchCity").value.trim().toLowerCase();
  let q = supabase.from("memorials").select("*");
  if(ln && ct) q = q.ilike("last_name",ln).ilike("city",ct);
  else if(ln)  q = q.ilike("last_name",ln);
  else if(ct)  q = q.ilike("city",ct);

  const { data, error } = await q;
  resultsContainer.innerHTML = "";
  if(error||!data?.length){
    resultsContainer.innerHTML = "<p>❌ Δεν βρέθηκαν αποτελέσματα.</p>";
    return;
  }
  data.forEach(entry => {
    const div = document.createElement("div");
    div.style="border:1px solid #ccc;padding:1rem;margin-bottom:1rem;border-radius:5px";
    div.innerHTML=`
      <strong>${entry.first_name} ${entry.last_name}</strong><br/>
      <small>${entry.city}, ${entry.region}</small><br/>
      <a href="/memorial.html?id=${entry.id}" target="_blank">➡️ Προβολή</a><br/>
      <button class="editBtn"   data-id="${entry.id}">✏️ Επεξεργασία</button>
      <button class="deleteBtn" data-id="${entry.id}">🗑️ Διαγραφή</button>
    `;
    resultsContainer.appendChild(div);
  });

  attachDeleteListeners();

  document.querySelectorAll(".editBtn").forEach(btn=>btn.addEventListener("click",async()=>{
    const { data, error } = await supabase.from("memorials").select("*").eq("id",btn.dataset.id).single();
    if(error||!data) return alert("Δεν βρέθηκε");
    form.firstname.value  = data.first_name;
    form.lastname.value   = data.last_name;
    form.birth_date.value = data.birth_date;
    form.death_date.value = data.death_date;
    form.gender.value     = data.gender;
    form.region.value     = data.region;
    form.city.value       = data.city;
    form.message.value    = data.message;
    form.photoUrl.value   = data.photo_url;
    form.video.value      = data.youtube_url;
    // load relationships
    const { data:rels } = await supabase.from("relationships").select("*").eq("memorial_id",data.id);
    relTableBody.innerHTML="";
    rels.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML=`<td>${r.relation_type}</td><td>${r.relative_id}</td><td><button class="delRel">❌</button></td>`;
      relTableBody.appendChild(tr);
    });
    updateGenealogy();
    alert("Φορτώθηκαν τα στοιχεία. Πάτησε 'Καταχώρηση' για να αποθηκεύσεις.");
  }));
});

// initial delete listeners
attachDeleteListeners();

// ================= Add relationships & upsert memorial =================
form.addEventListener("submit", async e => {
  e.preventDefault();

  // gather raw fields
  const rawFirstName = form.firstname.value.trim();
  const rawLastName  = form.lastname.value.trim();
  const rawCity      = form.city.value.trim();
  const birth_date   = form.birth_date.value;
  const death_date   = form.death_date.value;
  const gender       = form.gender.value;
  const region       = form.region.value.trim();
  const message      = form.message.value.trim();
  const photo_url    = form.photoUrl.value.trim();
  const youtube_url  = form.video.value.trim();

  // validation
  if(!rawFirstName||!rawLastName||!rawCity){
    return alert("Συμπλήρωσε Όνομα, Επώνυμο, Πόλη.");
  }
  if(birth_date && death_date && new Date(birth_date)>new Date(death_date)){
    return alert("Η ημερομηνία γέννησης δεν μπορεί να είναι μετά τον θάνατο.");
  }

  // latin + lowercase
  const latinFirst = toLatin(rawFirstName).toLowerCase();
  const last_name  = toLatin(rawLastName).toLowerCase();
  const city       = toLatin(rawCity).toLowerCase();

  try {
    // count existing
    const { count } = await supabase
      .from("memorials")
      .select("*",{ head:true,count:"exact" })
      .ilike("last_name",last_name)
      .ilike("city",city);
    const idx = (count||0)+1;
    const id  = `${last_name}${city}${partnerCode}${idx}`.replace(/\s+/g,'');

    // upsert memorial
    const { error:upErr } = await supabase.from("memorials")
      .upsert({ id, first_name:rawFirstName, last_name, birth_date, death_date, gender, region, city, message, photo_url, youtube_url, candles:0, created_at:new Date().toISOString() });
    if(upErr) throw upErr;

    // update relationships table in DB
    await supabase.from("relationships").delete().eq("memorial_id",id);
    const inserts = Array.from(relTableBody.children).map(tr=>{
      return { memorial_id:id, relative_id:tr.children[1].textContent, relation_type:tr.children[0].textContent };
    });
    if(inserts.length){
      const { error:relInsErr } = await supabase.from("relationships").insert(inserts);
      if(relInsErr) console.warn("rel insert error:",relInsErr);
    }

    // generate QR
    const memorialUrl = `${location.origin}/memorial.html?id=${id}`;
    const qrBlob      = await (await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(memorialUrl)}`)).blob();
    const fileName    = `${id}.png`;

    // upload QR
    const { error:upErr2 } = await supabase.storage.from("qr-codes").upload(fileName,qrBlob,{ contentType:"image/png" });
    if(upErr2) throw upErr2;

    // public URL
    const { data:pu, error:puErr } = supabase.storage.from("qr-codes").getPublicUrl(fileName);
    if(puErr) throw puErr;

    // preview
    qrPreview.innerHTML = `
      <img src="${pu.publicUrl}" style="max-width:300px; margin-bottom:1rem;">
      <div><a href="${memorialUrl}" target="_blank">${memorialUrl}</a></div>
      <a href="${pu.publicUrl}" download="${fileName}">⬇️ Κατέβασε το QR Code</a>
    `;

    alert("✅ Το memorial καταχωρήθηκε!");
    form.reset();
    relTableBody.innerHTML="";
    genealogyTa.value="";
    attachDeleteListeners();

  } catch(err){
    console.error("Submit error:",err);
    alert("❌ Κάτι πήγε στραβά. Έλεγξε το Console.");
  }
});

// ================= Logout handler =================
logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/login.html";
});
