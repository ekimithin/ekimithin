/* 
  ΑΡΧΕΙΟ: js/auth.js
  ΠΕΡΙΓΡΑΦΗ: Διαχειρίζεται τη σύνδεση και αποσύνδεση διαχειριστή μέσω Firebase Authentication.
  Προστατεύει το admin.html και ανακατευθύνει σωστά ανάλογα με την κατάσταση σύνδεσης.
*/

console.debug("[MODULE LOAD]", { module: "auth.js" });

import { auth } from './firebase.js';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

// Utility για εμφάνιση μηνυμάτων λάθους
function showError(message) {
  console.debug("[UI UPDATE]", { selector: "#error", text: message });
  const errorDiv = document.getElementById('error');
  if (errorDiv) errorDiv.textContent = message;
}

// --------------------------------------------------
// 1. Login page logic (login.html)
// --------------------------------------------------
if (window.location.pathname.includes('login.html')) {
  console.debug("[PAGE LOAD]", { page: "login.html" });

  const form     = document.getElementById('login-form');
  const errorDiv = document.getElementById('error');

  if (!form) {
    console.warn("[DOM MISSING]", "login-form");
  } else {
    console.debug("[DOM FOUND]", form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.debug("[EVENT]", "submit", { form: "login-form" });

      const email    = document.getElementById('email')?.value.trim()    || "";
      const password = document.getElementById('password')?.value.trim() || "";
      console.debug("[FORM DATA]", { email, password: password ? "***" : "" });

      // Validation βασικών πεδίων
      if (!email || !password) {
        console.warn("[VALIDATION]", "Missing email or password");
        showError('Παρακαλώ συμπληρώστε email και κωδικό.');
        return;
      }

      console.debug("[API CALL START]", { query: "signInWithEmailAndPassword", params: { email } });
      try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        console.debug("[API CALL RESULT]", { data: userCred.user, error: null });
        window.location.href = '/admin.html';
      } catch (err) {
        console.error("[API ERROR]", err);
        showError('Λάθος στοιχεία σύνδεσης. Δοκιμάστε ξανά.');
      }
    });
  }

  // Αν η συνεδρία υπάρχει ήδη, redirect στο admin
  console.debug("[AUTH]", "Listening onAuthStateChanged for login.html");
  onAuthStateChanged(auth, user => {
    console.debug("[AUTH]", "onAuthStateChanged", { user });
    if (user) {
      console.debug("[AUTH]", "User already logged in. Redirect to admin.html");
      window.location.href = '/admin.html';
    }
  });
}

// --------------------------------------------------
// 2. Admin page protection & logout (admin.html)
// --------------------------------------------------
if (window.location.pathname.includes('admin.html')) {
  console.debug("[PAGE LOAD]", { page: "admin.html" });

  // Αναμονή για αλλαγή κατάστασης auth
  console.debug("[AUTH]", "Listening onAuthStateChanged for admin.html");
  onAuthStateChanged(auth, user => {
    console.debug("[AUTH]", "onAuthStateChanged", { user });
    if (!user) {
      console.warn("[AUTH FAIL]", "User not authenticated. Redirect to login.html");
      window.location.href = '/login.html';
    } else {
      console.debug("[AUTH OK]", { user: user.email });
    }
  });

  // Logout button
  const logoutBtn = document.getElementById("logout-btn");
  if (!logoutBtn) {
    console.warn("[DOM MISSING]", "logout-btn");
  } else {
    console.debug("[DOM FOUND]", logoutBtn);
    logoutBtn.addEventListener("click", async (e) => {
      console.debug("[EVENT]", "click", { id: e.target.id });
      console.debug("[API CALL START]", { query: "signOut" });
      try {
        await signOut(auth);
        console.debug("[API CALL RESULT]", { data: "signed out", error: null });
        window.location.href = '/login.html';
      } catch (err) {
        console.error("[API ERROR]", err);
        alert('Σφάλμα κατά την αποσύνδεση. Δοκιμάστε ξανά.');
      }
    });
  }
}
