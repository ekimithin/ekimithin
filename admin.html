// js/admin.js
// 🔐 Διαχειριστικό panel - Supabase έκδοση

import { supabase } from "./supabase.js";

// 🔐 Προστασία admin - redirect αν δεν είναι συνδεδεμένος
(async () =&gt; {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) window.location.href = "/login.html";
})();

// 📥 Φόρμα δημιουργίας memorial
const form = document.getElementById("memorialForm");
const partnerCode = "A"; // συνεργάτης

form.addEventListener("submit", async (e) =&gt; {
  e.preventDefault();

  const firstname = form.firstname.value.trim();
  const lastname = form.lastname.value.trim().toLowerCase();
  const birth = form.birth.value;
  const death = form.death.value;
  const gender = form.gender.value;
  const region = form.region.value.trim();
  const city = form.city.value.trim().toLowerCase();
  const message = form.message.value.trim();
  const photoUrl = form.photoUrl.value.trim();
  const video = form.video.value.trim();

  try {
    // 🔍 Υπολογισμός αύξοντα αριθμού
    const { count } = await supabase
      .from("memorials")
      .select("*", { count: "exact", head: true })
      .ilike("lastname", lastname)
      .ilike("city", city);
    const index = (count || 0) + 1;

    const id = `${lastname}${city}${partnerCode}${index}`.replace(/\s+/g, '');
    const memorialUrl = `${location.origin}/memorial.html?id=${id}`;

    // 📤 Αποθήκευση
    const { error } = await supabase.from("memorials").upsert({
      id,
      firstname,
      lastname,
      birth,
      death,
      gender,
      region,
      city,
      message,
      photo_url: photoUrl,
      youtube_url: video,
      candles: 0,
      created_at: new Date().toISOString()
    });

    if (error) throw error;

    // 🧾 QR Code
    const qrImage = document.getElementById("qr-image");
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&amp;data=${encodeURIComponent(memorialUrl)}`;
    qrImage.src = qrUrl;
    qrImage.style.display = "block";

    const downloadLink = document.createElement("a");
    downloadLink.href = qrUrl;
    downloadLink.download = `${lastname}-${city}-qr.png`;
    downloadLink.textContent = "Κατέβασε το QR Code";
    downloadLink.style.display = "inline-block";
    downloadLink.style.marginTop = "1rem";
    document.getElementById("qr-preview").appendChild(downloadLink);

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

searchForm?.addEventListener("submit", async (e) =&gt; {
  e.preventDefault();
  const lastname = document.getElementById("searchLastname").value.trim().toLowerCase();
  const city = document.getElementById("searchCity").value.trim().toLowerCase();

  let query = supabase.from("memorials").select("*");

  if (lastname &amp;&amp; city) {
    query = query.ilike("lastname", lastname).ilike("city", city);
  } else if (lastname) {
    query = query.ilike("lastname", lastname);
  } else if (city) {
    query = query.ilike("city", city);
  }

  const { data, error } = await query;
  resultsContainer.innerHTML = "";

  if (error || !data || data.length === 0) {
    resultsContainer.innerHTML = "<p>Δεν βρέθηκαν αποτελέσματα.</p>";
    return;
  }

  data.forEach((entry) =&gt; {
    const div = document.createElement("div");
    div.style = "border:1px solid #ccc; padding:1rem; margin-bottom:1rem; border-radius:5px";

    div.innerHTML = `
      <strong>${entry.firstname} ${entry.lastname}</strong><br/>
<small>${entry.city}, ${entry.region}</small><br/>
<button class="editBtn" data-id="${entry.id}">✏️ Επεξεργασία</button>
<button class="deleteBtn" data-id="${entry.id}">🗑️ Διαγραφή</button>
    `;

    resultsContainer.appendChild(div);
  });

  // ✏️ Επεξεργασία
  document.querySelectorAll(".editBtn").forEach(btn =&gt; {
    btn.addEventListener("click", async () =&gt; {
      const id = btn.getAttribute("data-id");
      const { data, error } = await supabase.from("memorials").select("*").eq("id", id).single();
      if (error || !data) return alert("Δεν βρέθηκε το memorial");

      form.firstname.value = data.firstname;
      form.lastname.value = data.lastname;
      form.birth.value = data.birth;
      form.death.value = data.death;
      form.gender.value = data.gender;
      form.region.value = data.region;
      form.city.value = data.city;
      form.message.value = data.message;
      form.photoUrl.value = data.photo_url;
      form.video.value = data.youtube_url;

      alert("Τα στοιχεία φορτώθηκαν. Πάτησε 'Δημιουργία Memorial' για να τα αποθηκεύσεις.");
    });
  });

  // 🗑️ Διαγραφή
  document.querySelectorAll(".deleteBtn").forEach(btn =&gt; {
    btn.addEventListener("click", async () =&gt; {
      const id = btn.getAttribute("data-id");
      if (confirm("Θες σίγουρα να διαγράψεις αυτό το memorial;")) {
        const { error } = await supabase.from("memorials").delete().eq("id", id);
        if (!error) {
          btn.parentElement.remove();
          alert("Το memorial διαγράφηκε.");
        }
      }
    });
  });
});
