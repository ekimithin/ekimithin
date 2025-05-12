// js/sections/relationships.js

/**
 * Module: relationships.js
 * Φροντίζει τη διαδραστική διαχείριση των γενεαλογικών σχέσεων στο admin panel:
 * - Live search συγγενών από τον πίνακα memorials
 * - Επιλογή συγγενούς από τα αποτελέσματα
 * - Προσθήκη σχέσης στον πίνακα
 * - Διαγραφή σχέσης
 */

console.debug("[MODULE LOAD]", { module: "relationships.js" });

import { supabase } from "../supabase.js";

export function initRelationships() {
  // DOM elements
  const addBtn      = document.getElementById("addRelationshipBtn");
  const resultsList = document.getElementById("relativeResults");
  const table       = document.getElementById("relations-table");
  const inputId     = document.getElementById("relativeIdInput");
  const inputLast   = document.getElementById("relativeLastnameInput");
  const inputFirst  = document.getElementById("relativeFirstnameInput");
  const inputCity   = document.getElementById("relativeCityInput");
  const selectType  = document.getElementById("relationType");
  const noRow       = document.getElementById("noRelationshipsRow");

  // Έλεγχος ότι όλα τα στοιχεία υπάρχουν
  if (!addBtn || !resultsList || !table || !selectType) {
    console.warn("[RELATIONS INIT] Missing required elements");
    return;
  }
  console.debug("[DOM FOUND]", "relationships init elements OK");

  let searchTimer;

  // 1) Live search σε memorials για συγγενείς
  [inputId, inputLast, inputFirst, inputCity].forEach(field => {
    field.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        const qId   = inputId.value.trim();
        const qLn   = inputLast.value.trim();
        const qFn   = inputFirst.value.trim();
        const qCity = inputCity.value.trim();

        // Αν δεν υπάρχει query, καθαρίζουμε
        if (!qId && !qLn && !qFn && !qCity) {
          resultsList.innerHTML = "";
          return;
        }

        console.debug("[API CALL START]", {
          query: "search memorials",
          params: { qId, qLn, qFn, qCity }
        });

        const { data, error } = await supabase
          .from("memorials")
          .select("id, first_name, last_name, city")
          .ilike("id",        `%${qId}%`)
          .ilike("last_name", `%${qLn}%`)
          .ilike("first_name",`%${qFn}%`)
          .ilike("city",      `%${qCity}%`)
          .limit(5);

        console.debug("[API CALL RESULT]", { data, error });

        // Εμφάνιση αποτελεσμάτων
        resultsList.innerHTML = "";
        if (error) {
          console.error("[API ERROR]", error);
          return;
        }
        if (!data.length) {
          resultsList.innerHTML = "<li>Δεν βρέθηκαν εγγραφές.</li>";
          return;
        }
        data.forEach(m => {
          const li = document.createElement("li");
          li.textContent = `${m.id} — ${m.first_name} ${m.last_name} (${m.city})`;
          li.dataset.id   = m.id;
          li.dataset.name = `${m.first_name} ${m.last_name}`;
          resultsList.append(li);
        });
      }, 300);
    });
  });

  // 2) Επιλογή συγγενούς από τη λίστα
  resultsList.addEventListener("click", e => {
    if (e.target.tagName !== "LI" || !e.target.dataset.id) return;
    const relId   = e.target.dataset.id;
    const relName = e.target.dataset.name;

    console.debug("[EVENT]", "relative selected", { relId, relName });

    // Αποθηκεύουμε στο selectType για αργότερα
    selectType.dataset.relativeId   = relId;
    selectType.dataset.relativeName = relName;

    // Καθαρίζουμε τη λίστα
    resultsList.innerHTML = "";
  });

  // 3) Προσθήκη σχέσης στον πίνακα με το ➕
  addBtn.addEventListener("click", () => {
    const relId   = selectType.dataset.relativeId;
    const relName = selectType.dataset.relativeName;
    const relType = selectType.value;

    if (!relId || !relType) {
      alert("Επίλεξε πρώτα συγγενή και τύπο σχέσης.");
      return;
    }

    console.debug("[EVENT]", "add relationship", { relId, relName, relType });

    // Αφαιρούμε το placeholder row
    noRow.style.display = "none";

    // Δημιουργία νέας γραμμής
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-id="${relId}">${relName}</td>
      <td>${relType}</td>
      <td><button class="deleteBtn">🗑️</button></td>
    `;
    table.querySelector("tbody").append(tr);

    // Καθαρισμός πεδίων
    inputId.value = inputFirst.value = inputLast.value = inputCity.value = "";
    selectType.value = "";

    // 4) Διαγραφή γραμμής
    tr.querySelector(".deleteBtn").addEventListener("click", () => {
      tr.remove();
      console.debug("[EVENT]", "relationship removed", { relId, relType });
      // Αν δεν έχει απομείνει καμία γραμμή, εμφανίζουμε πάλι το placeholder
      if (!table.querySelector("tbody tr")) {
        noRow.style.display = "";
      }
    });
  });
}
