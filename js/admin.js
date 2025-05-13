// js/admin.js

import { supabase } from "./supabase.js";
import { initBioSection } from "./sections/biography.js";
import { initAwardsSection } from "./sections/awards.js";
import { initInterestsSection } from "./sections/interests.js";
import { initBurialSection } from "./sections/burial.js";
import { removeGreekDiacritics } from "./utils/greekUtils.js";
import "./sections/relationships.js";

// 🔐 Redirect αν δεν είσαι συνδεδεμένος
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) window.location.href = "/login.html";
})();

// ================= DOM elements =================
const form        = document.getElementById("memorialForm");
const logoutBtn   = document.getElementById("logoutBtn");
const qrPreview   = document.getElementById("qr-preview");
const searchForm  = document.getElementById("searchForm");
const resultsDiv  = document.getElementById("resultsContainer");

// ================= Διεύθυνση autocomplete + Χάρτης =================
const addrIn   = document.getElementById("addressInput");
const suggList = document.getElementById("suggestions");
let addrTimer;

addrIn?.addEventListener("input", () => {
  clearTimeout(addrTimer);
  const q = addrIn.value.trim();
  if (q.length < 3) { suggList.innerHTML = ""; return; }
  addrTimer = setTimeout(async () => {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
    const places = await res.json();
    suggList.innerHTML = places.slice(0, 5).map(p =>
      `<li data-lat="${p.lat}" data-lon="${p.lon}">${p.display_name}</li>`
    ).join("");
  }, 300);
});

suggList?.addEventListener("click", e => {
  if (e.target.tagName !== "LI") return;
  const { lat, lon } = e.target.dataset;
  const txt = e.target.textContent;
  const parts = txt.split(",");
  document.getElementById("region").value = parts[1]?.trim() || "";
  document.getElementById("city").value = parts[0]?.trim() || "";
  map.setView([lat, lon], 14);
  marker.setLatLng([lat, lon]);
  addrIn.value = "";
  suggList.innerHTML = "";
});

// Leaflet χάρτης
const map = L.map("map").setView([37.9838, 23.7275], 6);
const marker = L.marker([37.9838, 23.7275]).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

// ================= Διαγραφή Memorial =================
function attachDeleteListeners() {
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.replaceWith(btn.cloneNode(true));
  });
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!confirm("Θες σίγουρα να διαγράψεις αυτό το memorial;")) return;
      await supabase.storage.from("qr-codes").remove([`${id}.png`]);
      await supabase.from("relationships").delete().eq("memorial_id", id);
      const { error } = await supabase.from("memorials").delete().eq("id", id);
      if (error) return alert("❌ Σφάλμα διαγραφής.");
      btn.closest("div").remove();
      alert("✅ Διαγράφηκε memorial, σχέσεις & QR.");
    });
  });
}

// ================= Αναζήτηση memorials =================
searchForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const ln = document.getElementById("searchLastname").value.trim().toLowerCase();
  const ct = document.getElementById("searchCity").value.trim().toLowerCase();

  let q = supabase.from("memorials").select("*");
  if (ln && ct) q = q.ilike("last_name", ln).ilike("city", ct);
  else if (ln)  q = q.ilike("last_name", ln);
  else if (ct)  q = q.ilike("city", ct);

  const { data, error } = await q;
  resultsDiv.innerHTML = "";
  if (error || !data.length) {
    resultsDiv.innerHTML = "<p>❌ Δεν βρέθηκαν αποτελέσματα.</p>";
    return;
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
    resultsDiv.appendChild(div);
  });

  attachDeleteListeners();
  document.querySelectorAll(".editBtn").forEach(btn => {
    btn.addEventListener("click", () => loadForEdit(btn.dataset.id));
  });
});

// ================= Φόρτωση memorial για επεξεργασία =================
async function loadForEdit(id) {
  const { data, error } = await supabase.from("memorials").select("*").eq("id", id).single();
  if (error || !data) {
    alert("❌ Δεν βρέθηκε το memorial.");
    console.error(error);
    return;
  }

  form.dataset.id = id;
  form.firstname.value = data.first_name;
  form.lastname.value = data.last_name;
  form.birth_date.value = data.birth_date || "";
  form.death_date.value = data.death_date || "";
  form.gender.value = data.gender || "";
  form.city.value = data.city || "";
  form.region.value = data.region || "";
  form.message.value = data.message || "";
  form.photoUrl.value = data.photo_url || "";
  form.video.value = data.youtube_url || "";
  form.birth_place.value = data.birth_place || "";
  form.profession.value = data.profession || "";
  form.education.value = data.education || "";
  form.awards.value = data.awards || "";
  form.interests.value = data.interests || "";
  form.cemetery.value = data.cemetery || "";
  form.genealogy.value = data.genealogy || "";

  const { data: rels } = await supabase.from("relationships").select("*").eq("memorial_id", id);
  const tbody = document.querySelector("#relationshipsTable tbody");
  tbody.innerHTML = "";

  rels.forEach(r => {
    const tr = document.createElement("tr");
    tr.dataset.saved = "1";
    tr.innerHTML = `
      <td>${r.relation_type}</td>
      <td>${r.relative_id}</td>
      <td><button type="button" class="remove-relationship">✖️</button></td>
    `;
    tr.querySelector(".remove-relationship").addEventListener("click", () => tr.remove());
    tbody.appendChild(tr);
  });

  alert("✅ Memorial φορτώθηκε για επεξεργασία.");
}

// ================= Submit form =================
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const first = form.firstname.value.trim();
  const last = form.lastname.value.trim();
  const city = form.city.value.trim();
  if (!first || !last || !city) return alert("Συμπλήρωσε Όνομα, Επώνυμο, Πόλη.");

  const birth = form.birth_date.value || null;
  const death = form.death_date.value || null;
  if (birth && death && new Date(birth) > new Date(death)) return alert("Η γέννηση είναι μετά τον θάνατο.");
  if (!birth && death) return alert("❗ Έχεις θάνατο χωρίς γέννηση.");
  if (!death && birth) return alert("❗ Έχεις γέννηση χωρίς θάνατο.");

  const firstL = toLatin(first).toLowerCase();
  const lastL = toLatin(last).toLowerCase();
  const initials = toLatin(first[0] + last[0]).toLowerCase();
  const timestamp = Date.now().toString().slice(-6);
  const slug = `${firstL}-${lastL}`;
  const id = `${initials}${timestamp}-${slug}`;
  console.log("🆔 Final ID:", id); // ✅
  form.dataset.id = id;

  const dataToSave = {
    id,
    first_name: first,
    last_name: lastL,
    city: toLatin(city).toLowerCase(),
    region: form.region.value.trim(),
    gender: form.gender.value,
    birth_date: birth,
    death_date: death,
    message: form.message.value.trim(),
    photo_url: form.photoUrl.value.trim(),
    youtube_url: form.video.value.trim(),
    birth_place: form.birth_place.value.trim(),
    profession: form.profession.value.trim(),
    education: form.education.value.trim(),
    awards: form.awards.value.trim(),
    interests: form.interests.value.trim(),
    cemetery: form.cemetery.value.trim(),
    genealogy: form.genealogy.value.trim(),
    created_at: new Date().toISOString(),
    candles: 0
  };

  const { error: upErr } = await supabase.from("memorials").upsert(dataToSave);
  if (upErr) return alert("❌ Δεν αποθηκεύτηκε το memorial.");

  const rels = Array.from(document.querySelectorAll("#relationshipsTable tbody tr"))
    .filter(tr => !tr.dataset.saved)
    .map(tr => ({
      memorial_id: id,
      relative_id: tr.children[1]?.textContent.trim(),
      relation_type: tr.children[0]?.textContent.trim()
    }));

  if (rels.length > 0) {
    const { error: relErr } = await supabase.from("relationships").insert(rels);
    if (relErr) alert("❌ Οι σχέσεις δεν αποθηκεύτηκαν.");
  }

  const url = `${location.origin}/memorial.html?id=${id}`;
  const blob = await (await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`)).blob();
  const fileName = `${id}.png`;
  const { error: qrErr } = await supabase.storage.from("qr-codes").upload(fileName, blob, { contentType: "image/png", upsert: true });
  if (qrErr) return alert("❌ Το QR δεν αποθηκεύτηκε.");

  const { data: qr } = supabase.storage.from("qr-codes").getPublicUrl(fileName);
  qrPreview.innerHTML = `
    <img src="${qr.publicUrl}" style="max-width:300px;margin-bottom:1rem;" />
    <div><a href="${url}" target="_blank">${url}</a></div>
    <a href="${qr.publicUrl}" download="${fileName}">⬇️ Κατέβασε το QR</a>
  `;

  alert("✅ Το memorial καταχωρήθηκε!");
  
  await generatePdf(dataToSave, qr.publicUrl);
  
  form.reset();
  form.removeAttribute("data-id");
  document.querySelector("#relationshipsTable tbody").innerHTML = "";
});

// ================= Logout =================
logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/login.html";
});

document.getElementById("generatePdfBtn")?.addEventListener("click", async () => {
  const form = document.getElementById("memorialForm");
  const first = form.firstname.value.trim();
  const last = form.lastname.value.trim();
  const city = form.city.value.trim();
  const region = form.region.value.trim();
  const id = form.dataset.id || "χωρίς-id";

  const data = {
    first_name: first,
    last_name: last,
    city,
    region,
    id,
    birth_place: form.birth_place.value.trim(),
    profession: form.profession.value.trim(),
    education: form.education.value.trim(),
    awards: form.awards.value.trim(),
    interests: form.interests.value.trim(),
    cemetery: form.cemetery.value.trim(),
    genealogy: form.genealogy.value.trim()
  };

  const qrUrl = `https://glsayujqzkevokaznnrd.supabase.co/storage/v1/object/public/qr-codes/${id}.png`;

  const qrBase64 = await fetch(qrUrl)
    .then(res => res.blob())
    .then(blob => new Promise(res => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result);
      reader.readAsDataURL(blob);
    }))
    .catch(() => null); // fallback in case no QR exists

  const content = [
    { text: "Μνημείο Καταχώρησης", style: "header", alignment: "center", margin: [0, 0, 0, 20] },
    { text: `Ονοματεπώνυμο: ${data.last_name} ${data.first_name}`, style: "normal" },
    { text: `Τοποθεσία: ${data.city}, ${data.region}`, style: "normal", margin: [0, 0, 0, 10] },
    {
      style: "idBox",
      table: {
        widths: ['*'],
        body: [
          [{ text: `ID Εγγραφής: ${data.id}`, style: "idText" }],
          [{ text: "⚠️ ΠΡΟΣΟΧΗ\nΟ κωδικός καταχώρησης είναι μοναδικός.\nΣας παρακαλούμε να τον φυλάξετε για τυχόν μελλοντικές αλλαγές\nστη Βάση Ψηφιακής Μνήμης.", style: "warning" }]
        ]
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 0,
        hLineColor: () => 'red'
      },
      margin: [0, 0, 0, 15]
    }
  ];

  const labels = {
    birth_place: "Τόπος Γέννησης",
    profession: "Επάγγελμα",
    education: "Εκπαίδευση",
    awards: "Διακρίσεις",
    interests: "Ενδιαφέροντα",
    cemetery: "Κοιμητήριο",
    genealogy: "Γενεαλογικά"
  };

  for (const key in labels) {
    if (data[key]) {
      content.push({ text: `${labels[key]}: ${data[key]}`, style: "normal" });
    }
  }

  if (qrBase64) {
    content.push({ image: qrBase64, width: 150, alignment: "center", margin: [0, 20, 0, 0] });
  } else {
    content.push({ text: "❌ Δεν βρέθηκε QR", color: "red", margin: [0, 20, 0, 0] });
  }

  const docDefinition = {
    content,
    styles: {
      header: { fontSize: 18, bold: true },
      normal: { fontSize: 12 },
      idBox: { margin: [0, 10, 0, 10] },
      idText: { fontSize: 13, bold: true, color: 'red' },
      warning: { fontSize: 10, italics: true, color: 'red' }
    },
    defaultStyle: {
      font: 'Roboto'
    }
  };

  pdfMake.createPdf(docDefinition).download(`mnimeio-${data.id}.pdf`);
});




// ================= Init Modules =================
document.addEventListener("DOMContentLoaded", () => {
  initBioSection();
  initAwardsSection();
  initInterestsSection();
  initBurialSection();
});

// ================= Temp ID generator =================
["firstname", "lastname", "city"].forEach((field) => {
  const input = document.getElementById(field);
  input?.addEventListener("input", () => {
    const first = form.firstname.value.trim();
    const last = form.lastname.value.trim();
    const city = form.city.value.trim();
    if (!first || !last || !city) return;
    const tmp = `${toLatin(first[0] + last[0])}-${toLatin(city)}`.toLowerCase();
    form.dataset.id = `temp-${tmp}`;
  });
});

// ================= Helpers =================
function toLatin(text) {
  const map = {
    'ά':'a','έ':'e','ή':'i','ί':'i','ό':'o','ύ':'y','ώ':'o',
    'ς':'s','ϊ':'i','ϋ':'y','ΰ':'y','ΐ':'i',
    'α':'a','β':'b','γ':'g','δ':'d','ε':'e','ζ':'z','η':'i','θ':'th',
    'ι':'i','κ':'k','λ':'l','μ':'m','ν':'n','ξ':'x','ο':'o','π':'p',
    'ρ':'r','σ':'s','τ':'t','υ':'y','φ':'f','χ':'ch','ψ':'ps','ω':'o',
    'Α':'A','Β':'B','Γ':'G','Δ':'D','Ε':'E','Ζ':'Z','Η':'I','Θ':'Th',
    'Ι':'I','Κ':'K','Λ':'L','Μ':'M','Ν':'N','Ξ':'X','Ο':'O','Π':'P',
    'Ρ':'R','Σ':'S','Τ':'T','Υ':'Y','Φ':'F','Χ':'Ch','Ψ':'Ps','Ω':'O'
  };
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split('').map(c => map[c] || c).join('')
    .replace(/[^a-zA-Z0-9\-]/g, "");
}

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
async function executeSearch() {
  const idInput    = document.getElementById("searchId").value.trim();
  const lastInput  = document.getElementById("searchLastname").value.trim();
  const firstInput = document.getElementById("searchFirstname").value.trim();
  const cityInput  = document.getElementById("searchCity").value.trim();

  const id    = removeGreekDiacritics(idInput).toLowerCase();
  const last  = removeGreekDiacritics(lastInput).toLowerCase();
  const first = removeGreekDiacritics(firstInput).toLowerCase();
  const city  = removeGreekDiacritics(cityInput).toLowerCase();

  let query = supabase
    .from("memorials")
    .select("*")
    .order("created_at", { ascending: false });

  if (id)    query = query.ilike("id", `${id}%`);
  if (last)  query = query.ilike("last_name", `%${last}%`);
  if (first) query = query.ilike("first_name", `%${first}%`);
  if (city)  query = query.ilike("city", `%${city}%`);

  const { data, error } = await query;
  const resultsContainer = document.getElementById("resultsContainer");
  resultsContainer.innerHTML = "";

  if (error || !data || data.length === 0) {
    resultsContainer.innerHTML = "<p>❌ Δεν βρέθηκαν αποτελέσματα.</p>";
    return;
  }

  data.forEach(entry => {
    const div = document.createElement("div");
    div.className = "result-entry";
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
    btn.addEventListener("click", () => loadForEdit(btn.dataset.id));
  });
}

// ================= Live Search =================
["searchId", "searchLastname", "searchFirstname", "searchCity"].forEach(id => {
  const input = document.getElementById(id);
  if (input) input.addEventListener("input", debounce(executeSearch, 300));
});
