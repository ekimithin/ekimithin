// js/view.js
import { supabase } from './supabase.js';

// 🔍 Λήψη ID από URL
const urlParams = new URLSearchParams(window.location.search);
const id = urlParams.get('id');

if (!id) {
  alert("Δεν βρέθηκε το memorial.");
} else {
  loadMemorial(id);
}

async function loadMemorial(id) {
  const { data, error } = await supabase.from('memorials').select('*').eq('id', id).single();

  if (error || !data) {
    alert("Σφάλμα φόρτωσης memorial.");
    return;
  }

  // 💬 Εμφάνιση στοιχείων
  document.getElementById('fullName').textContent = `${data.first_name} ${data.last_name}`;

  const birth = data.birth_date ? new Date(data.birth_date) : null;
  const death = data.death_date ? new Date(data.death_date) : null;

  let datesText = '';
  if (birth && death) {
    const age = death.getFullYear() - birth.getFullYear();
    const birthStr = birth.toLocaleDateString('el-GR');
    const deathStr = death.toLocaleDateString('el-GR');
    datesText = `Έζησε από\n${birthStr} μέχρι ${deathStr}\nΑπεβίωσε σε ηλικία ${age} ετών`;
  }

  document.getElementById('dates').textContent = datesText;
  document.getElementById('location').textContent = `${data.city || ''}, ${data.region || ''}`;
  document.getElementById('photo').src = data.photo_url || '';
  document.getElementById('message').textContent = data.message || '';

  updateCandleCount(data.candles);

  // 🎞️ YouTube video
  if (data.youtube_url && data.youtube_url.includes("youtube.com/watch?v=")) {
    const videoId = data.youtube_url.split("v=")[1].split("&")[0];
    const iframe = document.createElement("iframe");
    iframe.width = "100%";
    iframe.height = "315";
    iframe.src = `https://www.youtube.com/embed/${videoId}`;
    iframe.frameBorder = "0";
    iframe.allowFullscreen = true;
    document.getElementById('videoContainer').appendChild(iframe);
  }

  // 🕯️ Άναψε κερί
  document.getElementById('lightCandleBtn')?.addEventListener('click', async () => {
    const { data: updated, error: candleError } = await supabase
      .rpc('increment_candle', { memorial_id: id });

    if (!candleError && updated !== null) {
      updateCandleCount(updated);
    } else {
      alert("❌ Σφάλμα κατά την καταγραφή του κεριού.");
    }
  });
}

// 📊 Ενημέρωση μηνύματος κεριών
function updateCandleCount(count) {
  const candleText = count === 1
    ? "1 κερί έχει ανάψει"
    : `${count} κεριά έχουν ανάψει`;
  document.getElementById('candleCount').textContent = candleText;
}
