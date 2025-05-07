// js/admin.js
import { supabase } from "./supabase.js";

// Συνάρτηση για μετατροπή ελληνικών χαρακτήρων σε λατινικούς
function toLatin(text) {
  const latinMap = {
    'ά': 'a', 'Ά': 'A', 'έ': 'e', 'Έ': 'E', 'ή': 'i', 'Ή': 'I',
    'ί': 'i', 'Ί': 'I', 'ό': 'o', 'Ό': 'O', 'ώ': 'o', 'Ώ': 'O',
    'ύ': 'y', 'Ύ': 'Y', 'ϋ': 'y', 'Ϋ': 'Y', 'α': 'a', 'Α': 'A',
    'β': 'b', 'Β': 'B', 'γ': 'g', 'Γ': 'G', 'δ': 'd', 'Δ': 'D',
    'ε': 'e', 'Ε': 'E', 'ζ': 'z', 'Ζ': 'Z', 'η': 'i', 'Η': 'I',
    'θ': 'th','Θ': 'Th','ι': 'i', 'Ι': 'I', 'κ': 'k', 'Κ': 'K',
    'λ': 'l', 'Λ': 'L', 'μ': 'm', 'Μ': 'M', 'ν': 'n', 'Ν': 'N',
    'ξ': 'x', 'Ξ': 'X', 'ο': 'o', 'Ο': 'O', 'π': 'p', 'Π': 'P',
    'ρ': 'r', 'Ρ': 'R', 'σ': 's', 'Σ': 'S', 'ς': 's', 'τ': 't',
    'υ': 'y', 'Υ': 'Y', 'φ': 'f', 'Φ': 'F', 'χ': 'ch','Χ': 'Ch',
    'ψ': 'ps','Ψ': 'Ps','ω': 'o', 'Ω': 'O'
  };
  return text
    .split('')
    .map(char => latinMap[char] || char)
    .join('');
}

// 🔐 Redirect στο login εάν δεν υπάρχει ενεργή session
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) window.location.href = "/login.html";
})();

// 📥 Δημιουργία memorial
const form = document.getElementById("memorialForm");
const partnerCode = "A";

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Παίρνουμε πρώτα τα raw πεδία
  const first_name = form.firstname.value.trim();
  const rawLastName = form.lastname.value.trim();
  const rawCity = form.city.value.trim();
  const birth_date = form.birth_date.value;
  const death_date = form.death_date.value;
  const gender = form.gender.value;
  const region = form.region.value.trim();
  const message = form.message.value.trim();
  const photo_url = form.photoUrl.value.trim();
  const youtube_url = form.video.value.trim();

  // Έλεγχος υποχρεωτικών
  if (!first_name || !rawLastName || !rawCity) {
    alert("Συμπλήρωσε όλα τα βασικά πεδία (Όνομα, Επώνυμο, Πόλη).");
    return;
  }

  // Έλεγχος ημ.γένεσης vs θανάτου
  if (birth_date && death_date && new Date(birth_date) > new Date(death_date)) {
    alert("❌ Η ημερομηνία γέννησης δεν μπορεί να είναι μετά τον θάνατο.");
    return;
  }

  // Μετατροπή σε λατινικούς και lowercase για ID/URL
  const last_name = toLatin(rawLastName).toLowerCase();
  const city = toLatin(rawCity).toLowerCase();

  try {
    // Βρίσκουμε πόσα ήδη υπάρχουν με ίδιο επώνυμο+πόλη, για αύξουσα αρίθμηση
    const { count } = await supabase
      .from("memorials")
      .select("*", { count: "exact", head: true })
      .ilike("last_name", last_name)
      .ilike("city", city);

    const index = (count || 0) + 1;
    const id = `${last_name}${city}${partnerCode}${index}`.replace(/\s+/g, '');

    const memorialUrl = `${location.origin}/memorial.html?id=${id}`;
    console.log("Memorial ID:", id);

    // Αποθήκευση/upsert
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
      candles: 0,
      created_at: new Date().toISOString()
    });

    if (error) throw error;

    // Εμφάνιση QR & Link
    const qrImage = document.getElementById("qr-image");
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(memorialUrl)}`;
    qrImage.src = qrUrl;
    qrImage.style.display = "block";

    const qrPreview = document.getElementById("qr-preview");
    qrPreview.innerHTML = "";

    const linkDiv = document.createElement("div");
    linkDiv.innerHTML = `<a href="${memorialUrl}" target="_blank">${memorialUrl}</a>`;
    linkDiv.style.marginTop = "1rem";

    const downloadLink = document.createElement("a");
    downloadLink.href = qrUrl;
    downloadLink.download = `${last_name}-${city}-qr.png`;
    downloadLink.textContent = "⬇️ Κατέβασε το QR Code";
    downloadLink.style.display = "inline-block";
    downloadLink.style.marginTop = "0.5rem";

    qrPreview.appendChild(qrImage);
    qrPreview.appendChild(linkDiv);
    qrPreview.appendChild(downloadLink);

    alert("✅ Το memorial καταχωρήθηκε!");
    form.reset();

  } catch (err) {
    console.error("❌ Σφάλμα:", err);
    alert("❌ Πρόβλημα κατά την αποθήκευση.");
  }
});

// 🔍 Αναζήτηση memorials (χωρίς αλλαγές)
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

  data.forEach(entry => {
    const div = document.createElement("div");
    div.style = "border:1px solid #ccc; padding:1rem; margin-bottom:1rem; border-radius:5px";
    div.innerHTML = `
      <strong>${entry.first_name} ${entry.last_name}</strong><br/>
      <small>${entry.city}, ${entry.region}</small><br/>
      <a href="/memorial.html?id=${entry.id}" target="_blank">➡️ Προβολή</a><br/>
      <button class="editBtn" data-id="${entry.id}">✏️ Επεξεργασία</button>
      <button class="deleteBtn" data-id="${entry.id}">🗑️ Διαγραφή</button>
    `;
    resultsContainer.appendChild(div);
  });

  // Επεξεργασία
  document.querySelectorAll(".editBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
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

      alert("Τα στοιχεία φορτώθηκαν. Πάτησε 'Καταχώρηση Memorial' για αποθήκευση.");
    });
  });

  // Διαγραφή
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
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
