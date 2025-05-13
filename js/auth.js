/* 
  ΑΡΧΕΙΟ: js/auth.js
  ΠΕΡΙΓΡΑΦΗ: Διαχειρίζεται τη σύνδεση και αποσύνδεση διαχειριστή μέσω Firebase Authentication.
  Προστατεύει το admin.html και ανακατευθύνει σωστά ανάλογα με την κατάσταση σύνδεσης.
*/

import { auth } from './firebase.js';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

// 🔐 Αν η σελίδα είναι login.html, χειριζόμαστε login
if (window.location.pathname.includes('login.html')) {
  const form = document.getElementById('login-form');
  const errorDiv = document.getElementById('error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = '/admin.html';
    } catch (err) {
      console.error("Login error:", err.message);
      errorDiv.textContent = 'Λάθος στοιχεία σύνδεσης. Δοκιμάστε ξανά.';
    }
  });

  // Αν είσαι ήδη συνδεδεμένος, πήγαινε admin
  onAuthStateChanged(auth, user => {
    if (user) window.location.href = '/admin.html';
  });
}

// 🔒 Αν η σελίδα είναι admin.html, επιτρέπεται είσοδος μόνο σε συνδεδεμένους
if (window.location.pathname.includes('admin.html')) {
  onAuthStateChanged(auth, user => {
    if (!user) {
      window.location.href = '/login.html';
    }
  });

  // 🔓 Αν υπάρχει κουμπί αποσύνδεσης, το ενεργοποιούμε
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "/login.html";
    });
  }
}
