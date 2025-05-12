// js/admin.js

import { supabase } from "./supabase.js";
import { initBioSection } from "./sections/biography.js";
import { initAwardsSection } from "./sections/awards.js";
import { initInterestsSection } from "./sections/interests.js";
import { initBurialSection } from "./sections/burial.js";
// Το relationships.js τώρα χειρίζεται όλο το UI & listeners για το relations‐table
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
    console.debug("No session – redirecting to login");
    window.location.href = "/login.html";
  } else {
    console.debug("Session active:", session);
  }
})();

// ================= DOM elements =================
const form      = document.getElementById("memorialForm");
const logoutBtn = document.getElementById("logoutBtn");
const qrPreview = document.getElementById("qr-preview");

// ================= Address autocomplete & Leaflet map =================
const addrIn   = document.getElementById("addressInput");
const suggList = document.getElementById("suggestions");
let addrTimer;
addrIn.addEventListener("input", () => {
  clearTimeout(addrTimer);
  const q = addrIn.value.trim();
  if (q.length < 3) { suggList.innerHTML = ""; return; }
  addrTimer = setTimeout(async () => {
    try {
      const res    = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
      const places = await res.json();
      console.debug("Autocomplete results:", places);
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
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

// ================= Delete‐buttons helper =================
function attachDeleteListeners() {
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.replaceWith(btn.cloneNode(true));
  });
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      console.debug("Deleting memorial:", id);
      if (!confirm("Θες σίγουρα να διαγράψεις αυτό το memorial;")) return;
      await supabase.storage.from("qr-codes").remove([`${id}.png`]);
      await supabase.from("relationships").delete().eq("memorial_id", id);
      const { error } = await supabase.from("memorials").delete().eq("id", id);
      if (error) {
        console.error("Delete error:", error);
        return alert("❌ Σφάλμα διαγραφής.");
      }
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
  console.debug("Search by", { ln, ct });
  let q = supabase.from("memorials").select("*");
  if (ln) q = q.ilike("last_name", ln);
  if (ct) q = q.ilike("city", ct);
  const { data, error } = await q;
  resultsContainer.innerHTML = "";
  if (error) {
    console.error("Search error:", error);
    return resultsContainer.innerHTML = "<p>❌ Σφάλμα αναζήτησης.</p>";
  }
  if (!data.length) {
    return resultsContainer.innerHTML = "<p>❌ Δεν βρέθηκαν αποτελέσματα.</p>";
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
    resultsContainer.appendChild(div);
  });
  attachDeleteListeners();

  document.querySelectorAll(".editBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      console.debug("Editing memorial:", id);
      const { data, error } = await supabase.from("memorials").select("*").eq("id", id).single();
      if (error || !data) {
        console.error("Load for edit error:", error);
        return alert("Δεν βρέθηκε.");
      }

      // fill basic fields
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

      // extra fields
      form.birth_place.value = data.birth_place  || "";
      form.profession.value  = data.profession   || "";
      form.education.value   = data.education    || "";
      form.awards.value      = data.awards       || "";
      form.interests.value   = data.interests    || "";
      form.cemetery.value    = data.cemetery     || "";
      form.genealogy.value   = data.genealogy    || "";

      // load relationships into #relations-table
      const { data: rels } = await supabase.from("relationships").select("*").eq("memorial_id", id);
      const tbody = document.querySelector("#relations-table tbody");
      tbody.innerHTML = "";
      rels.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${r.relative_first_name} ${r.relative_last_name}</td>
          <td>${r.relation_type}</td>
        `;
        tbody.appendChild(tr);
      });

      alert("Φορτώθηκαν τα στοιχεία. Πάτησε ‘Καταχώρηση’ για αποθήκευση.");
      attachDeleteListeners();
    });
  });
});

// αρχικοί delete‐listeners
attachDeleteListeners();

// ================= Submit handler με debug & extra fields =================
form.addEventListener("submit", async e => {
  e.preventDefault();
  console.debug("Form submit triggered");

  // gather + validation
  const rawFirst  = form.firstname.value.trim();
  const rawLast   = form.lastname.value.trim();
  const rawCity   = form.city.value.trim();
  const birthDate = form.birth_date.value || null;
  const deathDate = form.death_date.value || null;

  if (!rawFirst || !rawLast || !rawCity) {
    console.warn("Validation failed: missing required fields");
    return alert("Συμπλήρωσε Όνομα, Επώνυμο, Πόλη.");
  }
  if (birthDate && deathDate && new Date(birthDate) > new Date(deathDate)) {
    return alert("❌ Η ημερομηνία γέννησης δεν μπορεί να είναι μετά τον θάνατο.");
  }
  if (deathDate && new Date(deathDate) > new Date()) {
    return alert("❗ Η ημερομηνία θανάτου δεν μπορεί να είναι στο μέλλον.");
  }
  if (!birthDate && deathDate) {
    return alert("❗ Δεν έχεις καταχωρήσει ημερομηνία γέννησης.");
  }
  if (!deathDate && birthDate) {
    return alert("❗ Δεν έχεις καταχωρήσει ημερομηνία θανάτου.");
  }
  if (!birthDate && !deathDate) {
    if (!confirm("❗ Δεν έχεις καταχωρήσει ούτε ημερομηνία γέννησης ούτε θανάτου.\nΘέλεις να συνεχίσεις χωρίς αυτές;")) {
      return;
    }
  }

  // latinise + ID
  const latinFirst = toLatin(rawFirst).toLowerCase();
  const latinLast  = toLatin(rawLast).toLowerCase();
  const citySlug   = toLatin(rawCity).toLowerCase();
  const { count }  = await supabase
    .from("memorials")
    .select("*", { head: true, count: "exact" })
    .ilike("last_name", latinLast)
    .ilike("city", citySlug);
  const id = `${latinLast}${citySlug}A${(count||0)+1}`.replace(/\s+/g,'');
  console.debug("Computed ID:", id);

  // extra fields
  const birth_place = form.birth_place.value.trim();
  const profession  = form.profession.value.trim();
  const education   = form.education.value.trim();
  const awards      = form.awards.value.trim();
  const interests   = form.interests.value.trim();
  const cemetery    = form.cemetery.value.trim();
  const genealogy   = form.genealogy.value.trim();

  console.debug("Extra fields before upsert:", {
    birth_place, profession, education,
    awards, interests, cemetery, genealogy
  });

  try {
    // upsert με onConflict
    const { error: upErr } = await supabase
      .from("memorials")
      .upsert(
        {
          id,
          first_name:  rawFirst,
          last_name:   latinLast,
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
        },
        { onConflict: ['id'] }
      );
    if (upErr) throw upErr;
    console.debug("Upsert succeeded");

    // relationships
    console.debug("Deleting old relationships for:", id);
    await supabase.from("relationships").delete().eq("memorial_id", id);
    const relRows = Array.from(document.querySelectorAll("#relations-table tbody tr"));
    console.debug("Found relationship rows to insert:", relRows.length);
    if (relRows.length) {
      const toInsert = relRows
        .filter(tr => tr.children.length === 2)
        .map(tr => ({
          memorial_id:   id,
          relative_id:   tr.children[0].dataset.id,        // assumes data-id on <tr> cells
          relation_type: tr.children[1].textContent.trim()
        }));
      console.debug("Inserting relationships:", toInsert);
      await supabase.from("relationships").insert(toInsert);
    }

    // QR code
    const url    = `${location.origin}/memorial.html?id=${id}`;
    const qrBlob = await (await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`
    )).blob();
    const fn     = `${id}.png`;
    console.debug("Uploading QR code:", fn);
    await supabase.storage.from("qr-codes").upload(fn, qrBlob, { contentType: "image/png" });
    const { data: pu } = supabase.storage.from("qr-codes").getPublicUrl(fn);

    qrPreview.innerHTML = `
      <img src="${pu.publicUrl}" style="max-width:300px;margin-bottom:1rem;">
      <div><a href="${url}" target="_blank">${url}</a></div>
      <a href="${pu.publicUrl}" download="${fn}">⬇️ Κατέβασε το QR Code</a>
    `;
    alert("✅ Το memorial καταχωρήθηκε!");

    // reset form + relationships UI
    form.reset();
    document.querySelector("#relations-table tbody").innerHTML = `
      <tr><td colspan="2" style="text-align:center;">Δεν υπάρχουν καταχωρημένες σχέσεις.</td></tr>
    `;
    attachDeleteListeners();

  } catch (err) {
    console.error("Submit error:", err);
    alert("❌ Κάτι πήγε στραβά. Έλεγξε το Console.");
  }
});

// ================= Logout handler =================
logoutBtn.addEventListener("click", async () => {
  console.debug("Signing out");
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
