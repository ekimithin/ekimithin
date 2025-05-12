// js/sections/relationships.js

import { supabase } from "../supabase.js";

export function initRelationships(){
  const addBtn      = document.getElementById("addRelationshipBtn");
  const resultsList = document.getElementById("relativeResults");
  const table       = document.getElementById("relations-table");
  const inputId     = document.getElementById("relativeIdInput");
  const inputLast   = document.getElementById("relativeLastnameInput");
  const inputFirst  = document.getElementById("relativeFirstnameInput");
  const inputCity   = document.getElementById("relativeCityInput");
  const selectType  = document.getElementById("relationType");
  const noRow       = document.getElementById("noRelationshipsRow");
  if(!addBtn || !resultsList || !table) {
    console.warn("[RELATIONS INIT] Κάποιο στοιχείο λείπει");
    return;
  }

  let timer;
  // 1) Live search για συγγενείς
  [inputId, inputLast, inputFirst, inputCity].forEach(inp => {
    inp.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const { data, error } = await supabase
          .from("memorials")
          .select("id, first_name, last_name, city")
          .ilike("id",         `%${inputId.value}%`)
          .ilike("last_name",  `%${inputLast.value}%`)
          .ilike("first_name", `%${inputFirst.value}%`)
          .ilike("city",       `%${inputCity.value}%`)
          .limit(5);

        // Καθάρισμα λίστας
        resultsList.innerHTML = "";

        if (error) {
          console.error("[RELATIONS] Σφάλμα search:", error);
          return;
        }
        // Εμφάνιση αποτελεσμάτων
        data.forEach(m => {
          const li = document.createElement("li");
          li.textContent = `${m.first_name} ${m.last_name} — ${m.city}`;
          li.dataset.id = m.id;
          li.dataset.fn = m.first_name;
          li.dataset.ln = m.last_name;
          li.dataset.city = m.city;
          resultsList.append(li);
        });
      }, 300);
    });
  });

  // 2) Όταν επιλέγω από τη λίστα, γεμίζουν τα πεδία
  resultsList.addEventListener("click", e => {
    if (e.target.tagName !== "LI") return;

    const id   = e.target.dataset.id;
    const fn   = e.target.dataset.fn;
    const ln   = e.target.dataset.ln;
    const ct   = e.target.dataset.city;

    // Γέμισμα των πεδίων
    inputId.value    = id;
    inputFirst.value = fn;
    inputLast.value  = ln;
    inputCity.value  = ct;

    // Reset τύπου σχέσης
    selectType.value = "";
    selectType.dataset.relativeId   = id;
    selectType.dataset.relativeName = `${fn} ${ln}`;

    // Καθάρισμα λίστας
    resultsList.innerHTML = "";
  });

  // 3) Προσθήκη σχέσης στον πίνακα
  addBtn.addEventListener("click", () => {
    const relId   = selectType.dataset.relativeId;
    const relName = selectType.dataset.relativeName;
    const relType = selectType.value;

    if (!relId || !relType) {
      return alert("Επίλεξε πρώτα συγγενή και τύπο σχέσης.");
    }

    // Απόκρυψη placeholder
    noRow.style.display = "none";

    // Δημιουργία σειράς
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-id="${relId}">${relName}</td>
      <td>${relType}</td>
      <td><button class="deleteBtn">🗑️</button></td>
    `;
    table.querySelector("tbody").append(tr);

    // Listener για διαγραφή
    tr.querySelector(".deleteBtn").addEventListener("click", () => {
      tr.remove();
      const anyRow = table.querySelector("tbody tr");
      if (!anyRow) {
        noRow.style.display = "";
      }
    });

    // Καθαρισμός πεδίων εισαγωγής
    inputId.value = inputLast.value = inputFirst.value = inputCity.value = "";
    selectType.value = "";
    delete selectType.dataset.relativeId;
    delete selectType.dataset.relativeName;
  });
}
