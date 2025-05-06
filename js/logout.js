// js/logout.js
// 🔓 Αποσύνδεση χρήστη από το Supabase

import { supabase } from './supabase.js';

const logoutBtn = document.getElementById('logoutBtn');

logoutBtn?.addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    alert("❌ Αποτυχία αποσύνδεσης");
    console.error(error);
  } else {
    alert("✅ Έγινε αποσύνδεση");
    window.location.href = "/login.html";
  }
});
