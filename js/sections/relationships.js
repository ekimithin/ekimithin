// js/sections/relationships.js

import { supabase } from "../supabase.js";

export function initRelationships() {
  const addBtn      = document.getElementById("addRelationshipBtn");
  const resultsList = document.getElementById("relativeResults");
  const table       = document.getElementById("relations-table");
  const inputId     = document.getElementById("relativeIdInput");
  const inputLast   = document.getElementById("relativeLastnameInput");
  const inputFirst  = document.getElementById("relativeFirstnameInput");
  const inputCity   = document.getElementById("relativeCityInput");
  const selectType  = document.getElementById("relationType");
  const noRow       = document.getElementById("noRelationshipsRow");

  if (!table || !addBtn || !resultsList) {
    console.warn("[RELATIONS INIT] missing elements");
    return;
  }

  let searchTimer;
  // 1) Live search memorials for relatives
  [inputId, inputLast, inputFirst, inputCity].forEach(inp => {
    inp.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        const q = supabase
          .from("memorials")
          .select("id, first_name, last_name, city")
          .ilike("id", `%${inputId.value}%`)
          .ilike("last_name", `%${inputLast.value}%`)
          .ilike("first_name", `%${inputFirst.value}%`)
          .ilike("city", `%${inputCity.value}%`)
          .limit(5);
        const { data, error } = await q;
        resultsList.innerHTML = "";
        if (!data || error) return;
        data.forEach(m => {
          const li = document.createElement("li");
          li.textContent = `${m.first_name} ${m.last_name} — ${m.city}`;
          li.dataset.id  = m.id;
          li.dataset.fn  = m.first_name;
          li.dataset.ln  = m.last_name;
          resultsList.append(li);
        });
      }, 300);
    });
  });

  // 2) Όταν επιλέγεις κάποιο li, το προεπισκοπείς
  resultsList.addEventListener("click", e => {
    if (e.target.tagName !== "LI") return;
    // Σβήνουμε τη λίστα
    const id   = e.target.dataset.id;
    const fn   = e.target.dataset.fn;
    const ln   = e.target.dataset.ln;
    selectType.value = ""; // reset
    // Αποθηκεύουμε σε custom fields για το add:
    selectType.dataset.relativeId = id;
    selectType.dataset.relativeName = `${fn} ${ln}`;
    resultsList.innerHTML = "";
  });

  // 3) Όταν πατάς το ➕, προσθέτεις γραμμή στον πίνακα
  addBtn.addEventListener("click", () => {
    const relId   = selectType.dataset.relativeId;
    const relName = selectType.dataset.relativeName;
    const relType = selectType.value;
    if (!relId || !relType) {
      alert("Επίλεξε συγγενή και τύπο σχέσης.");
      return;
    }
    // Αφαιρούμε το placeholder
    noRow.style.display = "none";
    // Δημιουργούμε tr
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-id="${relId}">${relName}</td>
      <td>${relType}</td>
      <td><button class="deleteBtn">🗑️</button></td>
    `;
    table.querySelector("tbody").append(tr);
    // Cleanup inputs
    inputId.value = inputFirst.value = inputLast.value = inputCity.value = "";
    selectType.value = "";
    // Attach delete listener
    tr.querySelector(".deleteBtn").addEventListener("click", () => {
      tr.remove();
      if (!table.querySelector("tbody tr")) {
        noRow.style.display = "";
      }
    });
  });
}
