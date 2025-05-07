import { supabase } from "./supabase.js";

// 🔐 Έλεγχος σύνδεσης
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) window.location.href = "/login.html";
})();

// 📥 Δημιουργία memorial
const form = document.getElementById("memorialForm");
const partnerCode = "A";

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const first_name = form.firstname.value.trim();
  const last_name = form.lastname.value.trim().toLowerCase();
  const birth_date = form.birth_date.value;
  const death_date = form.death_date.value;
  const gender = form.gender.value;
  const region = form.region.value.trim();
  const city = form.city.value.trim().toLowerCase();
  const message = form.message.value.trim();
  const photo_url = form.photoUrl.value.trim();
  const youtube_url = form.video.value.trim();

  if (!first_name || !last_name || !city) {
    alert("Συμπλήρωσε όλα τα βασικά πεδία.");
    return;
  }

  if (birth_date && death_date && new Date(birth_date) > new Date(death_date)) {
    alert("❌ Η ημ/νία γέννησης δεν μπορεί να είναι μετά τον θάνατο.");
    return;
  }

  try {
    const { count } = await supabase
      .from("memorials")
      .select("*", { count: "exact", head: true })
      .ilike("last_name", last_name)
      .ilike("city", city);

    const index = (count || 0) + 1;
    const id = `${last_name}${city}${partnerCode}${index}`.replace(/\s+/g, '');
    const memorialUrl = `${location.origin}/memorial.html?id=${id}`;

    // 🧾 Δημιουργία QR εικόνας
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(memorialUrl)}`;
    const qrBlob = await (await fetch(qrUrl)).blob();
    const qrFile = new File([qrBlob], `${id}.png`, { type: "image/png" });

    // ⬆️ Αποθήκευση QR στο Supabase Storage
    const { error: uploadError } = await supabase.storage.from("qr-codes").upload(`${id}.png`, qrFile, { upsert: true });
    if (uploadError) throw uploadError;

    const qrPublicUrl = supabase.storage.from("qr-codes").getPublicUrl(`${id}.png`).data.publicUrl;

    // 🔄 Αποθήκευση memorial με qr_url
    const { error } = await supabase.from("memorials").upsert({
      id,
      first_name,
      last_name,
      birth_date,
      death_date,
      gender,
      region,
      city,
      message,
      photo_url,
      youtube_url,
      qr_url: qrPublicUrl,
      candles: 0,
      created_at: new Date().toISOString()
    });

    if (error) throw error;

    // ✅ Προεπισκόπηση
    const qrImage = document.getElementById("qr-image");
    qrImage.src = qrPublicUrl;
    qrImage.style.display = "block";

    const qrPreview = document.getElementById("qr-preview");
    qrPreview.innerHTML += `
      <div style="margin-top:1rem;">
        <a href="${memorialUrl}" target="_blank">${memorialUrl}</a><br/>
        <a href="${qrPublicUrl}" download="${id}-qr.png">⬇️ Κατέβασε το QR Code</a>
      </div>
    `;

    alert("✅ Το memorial καταχωρήθηκε!");
    form.reset();

  } catch (err) {
    console.error("❌ Σφάλμα:", err);
    alert("❌ Πρόβλημα κατά την αποθήκευση.");
  }
});

// 🔍 Αναζήτηση memorials
const searchForm = document.getElementById("searchForm");
const resultsContainer = document.getElementById("resultsContainer");

searchForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const lastname = document.getElementById("searchLastname").value.trim().toLowerCase();
  const city = document.getElementById("searchCity").value.trim().toLowerCase();

  let query = supabase.from("memorials").select("*");

  if (lastname && city) {
    query = query.ilike("last_name", lastname).ilike("city", city);
  } else if (lastname) {
    query = query.ilike("last_name", lastname);
  } else if (city) {
    query = query.ilike("city", city);
  }

  const { data, error } = await query;
  resultsContainer.innerHTML = "";

  if (error || !data || data.length === 0) {
    resultsContainer.innerHTML = "<p>❌ Δεν βρέθηκαν αποτελέσματα.</p>";
    return;
  }

  data.forEach((entry, index) => {
    const div = document.createElement("div");
    div.style = "border:1px solid #ccc; padding:1rem; margin-bottom:1rem; border-radius:5px; display:flex; gap:1rem;";

    div.innerHTML = `
      <div style="flex:1;">
        <strong>${index + 1}. ${entry.first_name} ${entry.last_name} 
          <span style="color: red;">(ID: ${entry.id})</span>
        </strong><br/>
        <small>${entry.city}, ${entry.region}</small><br/>
        <a href="/memorial.html?id=${entry.id}" target="_blank">➡️ Προβολή</a><br/>
        <button class="editBtn" data-id="${entry.id}">✏️ Επεξεργασία</button>
        <button class="deleteBtn" data-id="${entry.id}">🗑️ Διαγραφή</button>
      </div>
      <div style="width: 100px;">
        ${entry.qr_url ? `<img src="${entry.qr_url}" alt="QR" style="width:100%;" />` : ''}
      </div>
    `;

    resultsContainer.appendChild(div);
  });

  // ✏️ Επεξεργασία
  document.querySelectorAll(".editBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const { data, error } = await supabase.from("memorials").select("*").eq("id", id).single();
      if (error || !data) return alert("Δεν βρέθηκε το memorial");

      form.firstname.value = data.first_name;
      form.lastname.value = data.last_name;
      form.birth_date.value = data.birth_date;
      form.death_date.value = data.death_date;
      form.gender.value = data.gender;
      form.region.value = data.region;
      form.city.value = data.city;
      form.message.value = data.message;
      form.photoUrl.value = data.photo_url;
      form.video.value = data.youtube_url;

      alert("Φόρτωσε τα στοιχεία. Πάτησε 'Καταχώρηση Memorial' για αποθήκευση.");
    });
  });

  // 🗑️ Διαγραφή memorial + QR
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      if (!confirm("Θες σίγουρα να διαγράψεις αυτό το memorial;")) return;

      const { error: deleteError } = await supabase.from("memorials").delete().eq("id", id);
      await supabase.storage.from("qr-codes").remove([`${id}.png`]);

      if (!deleteError) {
        btn.closest("div").remove();
        alert("Το memorial διαγράφηκε.");
      }
    });
  });
});
