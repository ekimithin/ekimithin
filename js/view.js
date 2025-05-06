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
  document.getElementById('fullName').textContent = `${data.firstname} ${data.lastname}`;
  document.getElementById('dates').textContent = `${data.birth || ''} - ${data.death || ''}`;
  document.getElementById('location').textContent = `${data.city}, ${data.region}`;
  document.getElementById('photo').src = data.photo_url;
  document.getElementById('message').textContent = data.message;
  document.getElementById('candleCount').textContent = data.candles || 0;

  // 🎞️ Εμφάνιση video αν υπάρχει
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

  // 🕯️ Κουμπί για "Άναψε κερί"
  document.getElementById('lightCandleBtn').addEventListener('click', async () => {
    const { data: updated, error: candleError } = await supabase
      .from('memorials')
      .update({ candles: data.candles + 1 })
      .eq('id', id)
      .select()
      .single();

    if (!candleError) {
      document.getElementById('candleCount').textContent = updated.candles;
    }
  });
}
