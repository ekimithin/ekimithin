// js/sections/relationships.js
import { supabase } from "../supabase.js";

export function initRelationships() {
  const addBtn      = document.getElementById("addRelationshipBtn");
  const resultsList = document.getElementById("relativeResults");
  const tableBody   = document.querySelector("#relations-table tbody");
  const inputId     = document.getElementById("relativeIdInput");
  const inputLast   = document.getElementById("relativeLastnameInput");
  const inputFirst  = document.getElementById("relativeFirstnameInput");
  const inputCity   = document.getElementById("relativeCityInput");
  const selectType  = document.getElementById("relationType");
  const noRow       = document.getElementById("noRelationshipsRow");

  if (!resultsList || !addBtn || !tableBody) {
    console.warn("[RELATIONS INIT] missing elements");
    return;
  }

  // 1) Live search memorials for relatives
  let timer;
  [inputId, inputLast, inputFirst, inputCity].forEach(inp => {
    inp.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const { data, error } = await supabase
          .from("memorials")
          .select("id, first_name, last_name, city")
          .ilike("id", `%${inputId.value}%`)
          .ilike("last_name", `%${inputLast.value}%`)
          .ilike("first_name", `%${inputFirst.value}%`)
          .ilike("city", `%${inputCity.value}%`)
          .limit(5);

        resultsList.innerHTML = "";
        if (error || !data) return;

        data.forEach(m => {
          const li = document.createElement("li");
          li.textContent = `${m.first_name} ${m.last_name} — ${m.city}`;
          // αποθηκεύουμε συστατικά για να τα γεμίσουμε
          li.dataset.id   = m.id;
          li.dataset.fn   = m.first_name;
          li.dataset.ln   = m.last_name;
          li.dataset.city = m.city;
          resultsList.append(li);
        });
      }, 300);
    });
  });

  // 2) Όταν επιλέγεις κάποιο li, γεμίζεις τα πεδία
  resultsList.addEventListener("click", e => {
    if (e.target.tagName !== "LI") return;

    const { id, fn, ln, city } = e.target.dataset;

    // συμπληρώνουμε τα πεδία
    inputId.value    = id;
    inputFirst.value = fn;
    inputLast.value  = ln;
    inputCity.value  = city;

    // reset relation type
    selectType.value = "";

    // αποθηκεύουμε και στο selectType τα δεδομένα για το add
    selectType.dataset.relativeId   = id;
    selectType.dataset.relativeName = `${fn} ${ln}`;

    // καθαρίζουμε τη λίστα
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

    // Αφαιρούμε το placeholder row
    noRow.style.display = "none";

    // Δημιουργούμε νέο tr
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-id="${relId}">${relName}</td>
      <td>${relType}</td>
      <td><button class="deleteBtn">🗑️</button></td>
    `;
    tableBody.append(tr);

    // listener για διαγραφή γραμμής
    tr.querySelector(".deleteBtn").addEventListener("click", () => {
      tr.remove();
      if (!tableBody.querySelector("tr")) {
        noRow.style.display = "";
      }
    });

    // καθαρίζουμε inputs
    inputId.value = inputFirst.value = inputLast.value = inputCity.value = "";
    selectType.value = "";
  });
}
