// js/admin.js
import { supabase } from "./supabase.js";
import { initBioSection } from "./sections/biography.js";
import { initAwardsSection } from "./sections/awards.js";
import { initInterestsSection } from "./sections/interests.js";
import { initBurialSection } from "./sections/burial.js";
// το relationships.js έχει ήδη listeners/DOM setup
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
  if (!session) window.location.href = "/login.html";
})();

// ================= DOM elements =================
const form       = document.getElementById("memorialForm");
const logoutBtn  = document.getElementById("logoutBtn");
const qrPreview  = document.getElementById("qr-preview");

// ================= Address autocomplete & map =================
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

// Leaflet map init
const map    = L.map("map").setView([37.9838, 23.7275], 6);
const marker = L.marker([37.9838, 23.7275]).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 })
 .addTo(map);

// ================= Attach delete-buttons helper =================
function attachDeleteListeners() {
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.replaceWith(btn.cloneNode(true));
  });
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!confirm("Θες σίγουρα να διαγράψεις αυτό το memorial;")) return;
      // remove QR
      await supabase.storage.from("qr-codes").remove([`${id}.png`]);
      // remove relationships
      await supabase
        .from("relationships")
        .delete()
        .eq("memorial_id", id);
      // remove memorial
      const { error } = await supabase
        .from("memorials")
        .delete()
        .eq("id", id);
      if (error) return alert("❌ Σφάλμα διαγραφής.");
      btn.closest("div").remove();
      alert("✅ Διαγράφηκε memorial, σχέσεις & QR.");
    });
  });
}

// ================= Search existing memorials =================
const searchForm       = document.getElementById("searchForm");
const resultsContainer = document.getElementById("resultsContainer");

searchForm.addEventListener("submit", async e => {
  e.preventDefault();
  const ln = document.getElementById("searchLastname").value.trim().toLowerCase();
  const ct = document.getElementById("searchCity").value.trim().toLowerCase();
  let q = supabase.from("memorials").select("*");
  if (ln && ct) q = q.ilike("last_name", ln).ilike("city", ct);
  else if (ln)   q = q.ilike("last_name", ln);
  else if (ct)   q = q.ilike("city", ct);

  const { data, error } = await q;
  resultsContainer.innerHTML = "";

  if (error || !data.length) {
    resultsContainer.innerHTML = "<p>❌ Δεν βρέθηκαν αποτελέσματα.</p>";
    return;
  }

  data.forEach(entry => {
    const div = document.createElement("div");
    div.style = "border:1px solid #ccc;padding:1rem;margin-bottom:1rem;border-radius:5px";
    div.innerHTML = `
      <strong>${entry.first_name} ${entry.last_name}</strong><br/>
      <small>${entry.city}, ${entry.region}</small><br/>
      <a href="/memorial.html?id=${entry.id}" target="_blank">➡️ Προβολή</a><br/>
      <button class="editBtn"   data-id="${entry.id}">✏️ Επεξεργασία</button>
      <button class="deleteBtn" data-id="${entry.id}">🗑️ Διαγραφή</button>
    `;
    resultsContainer.appendChild(div);
  });

  attachDeleteListeners();

  document.querySelectorAll(".editBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const { data, error } = await supabase
        .from("memorials")
        .select("*")
        .eq("id", btn.dataset.id)
        .single();
      if (error || !data) return alert("Δεν βρέθηκε.");

      // Fill form
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

      // Load relationships
      const { data: rels } = await supabase
        .from("relationships")
        .select("*")
        .eq("memorial_id", data.id);

      const tbody = document.querySelector("#relationshipsTable tbody");
      tbody.innerHTML = "";
      rels.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${r.relation_type}</td>
          <td>${r.relative_id}</td>
          <td><button class="delRel">❌</button></td>
        `;
        tbody.appendChild(tr);
      });

      alert("Φορτώθηκαν τα στοιχεία. Πάτησε ‘Καταχώρηση’ για να αποθηκεύσεις.");
      attachDeleteListeners();
    });
  });
});

// initial delete listeners
attachDeleteListeners();

// ================= Submit handler =================
form.addEventListener("submit", async e => {
  e.preventDefault();

  // Gather + validate
  const rawFirst  = form.firstname.value.trim();
  const rawLast   = form.lastname.value.trim();
  const rawCity   = form.city.value.trim();
  const birth     = form.birth_date.value;
  const death     = form.death_date.value;

  if (!rawFirst || !rawLast || !rawCity) {
    return alert("Συμπλήρωσε Όνομα, Επώνυμο, Πόλη.");
  }
  if (birth && death && new Date(birth) > new Date(death)) {
    return alert("Η ημερομηνία γέννησης δεν μπορεί να είναι μετά τον θάνατο.");
  }

  // Latin + lowercase
  const latinFirst = toLatin(rawFirst).toLowerCase();
  const last_name  = toLatin(rawLast).toLowerCase();
  const city       = toLatin(rawCity).toLowerCase();

  try {
    // Compute ID
    const { count } = await supabase
      .from("memorials")
      .select("*", { head: true, count: "exact" })
      .ilike("last_name", last_name)
      .ilike("city", city);
    const idx = (count || 0) + 1;
    const id  = `${last_name}${city}A${idx}`.replace(/\s+/g, '');

    // Upsert memorial
    const { error: upErr } = await supabase.from("memorials").upsert({
      id,
      first_name:  rawFirst,
      last_name,
      birth_date:  birth,
      death_date:  death,
      gender:      form.gender.value,
      region:      form.region.value.trim(),
      city,
      message:     form.message.value.trim(),
      photo_url:   form.photoUrl.value.trim(),
      youtube_url: form.video.value.trim(),
      candles:     0,
      created_at:  new Date().toISOString()
    });
    if (upErr) throw upErr;

    // Collect relationships (attributes injected by sections/relationships.js)
    const relTBody = document.querySelector("#relationshipsTable tbody");
    const relRows  = Array.from(relTBody.children);
    // delete old
    await supabase.from("relationships").delete().eq("memorial_id", id);
    // insert new
    if (relRows.length) {
      const inserts = relRows.map(tr => ({
        memorial_id:   id,
        relative_id:   tr.children[1].textContent,
        relation_type: tr.children[0].textContent
      }));
      await supabase.from("relationships").insert(inserts);
    }

    // Generate & upload QR
    const url    = `${location.origin}/memorial.html?id=${id}`;
    const qrBlob = await (await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`
    )).blob();
    const fn     = `${id}.png`;
    await supabase.storage
      .from("qr-codes")
      .upload(fn, qrBlob, { contentType: "image/png" });
    const { data: pu } = supabase.storage
      .from("qr-codes")
      .getPublicUrl(fn);

    // Preview
    qrPreview.innerHTML = `
      <img src="${pu.publicUrl}" style="max-width:300px;margin-bottom:1rem;">
      <div><a href="${url}" target="_blank">${url}</a></div>
      <a href="${pu.publicUrl}" download="${fn}">⬇️ Κατέβασε το QR Code</a>
    `;

    alert("✅ Το memorial καταχωρήθηκε!");
    form.reset();
    document.querySelector("#relationshipsTable tbody").innerHTML = "";
    attachDeleteListeners();

  } catch (err) {
    console.error("Submit error:", err);
    alert("❌ Κάτι πήγε στραβά. Έλεγξε το Console.");
  }
});

// ================= Logout handler =================
logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/login.html";
});

// ================= Init section modules =================
document.addEventListener("DOMContentLoaded", () => {
  initBioSection();
  initAwardsSection();
  initInterestsSection();
  initBurialSection();
});
