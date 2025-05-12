// js/sections/relationships.js

import { supabase } from "../supabase.js";

// === DOM elements ===
const idInput       = document.getElementById("relativeIdInput");
const lastInput     = document.getElementById("relativeLastnameInput");
const firstInput    = document.getElementById("relativeFirstnameInput");
const cityInput     = document.getElementById("relativeCityInput");
const resultsUl     = document.getElementById("relativeResults");
const addBtn        = document.getElementById("addRelationshipBtn");
const relationsTable  = document.getElementById("relations-table");
const relationsTbody  = relationsTable.querySelector("tbody");

let searchTimer;

// === Debounced search ===
function searchRelatives() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const idVal = idInput.value.trim();
    const lnVal = lastInput.value.trim().toLowerCase();
    const fnVal = firstInput.value.trim().toLowerCase();
    const ctVal = cityInput.value.trim().toLowerCase();

    console.debug("🔍 Searching relatives with:", { idVal, lnVal, fnVal, ctVal });

    let query = supabase
      .from("memorials")
      .select("id, first_name, last_name, city")
      .limit(5);

    if (idVal) {
      query = query.eq("id", idVal);
    } else {
      if (lnVal) query = query.ilike("last_name", `%${lnVal}%`);
      if (fnVal) query = query.ilike("first_name", `%${fnVal}%`);
      if (ctVal) query = query.ilike("city", `%${ctVal}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("❌ Relatives search error:", error);
      resultsUl.innerHTML = `<li>Σφάλμα αναζήτησης.</li>`;
      return;
    }

    resultsUl.innerHTML = "";
    if (!data.length) {
      console.debug("No relatives found");
      resultsUl.innerHTML = `<li>Δεν βρέθηκαν συγγενείς.</li>`;
      return;
    }

    data.forEach(r => {
      const li = document.createElement("li");
      li.textContent        = `${r.first_name} ${r.last_name} (${r.city})`;

      // **Βάζουμε εδώ τα σωστά data- attributes**
      li.dataset.id         = r.id;
      li.dataset.firstname  = r.first_name;
      li.dataset.lastname   = r.last_name;
      li.dataset.city       = r.city;

      resultsUl.appendChild(li);
    });
  }, 300);
}

// attach search to inputs
[idInput, lastInput, firstInput, cityInput].forEach(el =>
  el.addEventListener("input", searchRelatives)
);

// === When user clicks a result ===
resultsUl.addEventListener("click", e => {
  if (e.target.tagName !== "LI") return;
  const li = e.target;

  // debug print για να δούμε τι dataset έχει
  console.debug("✅ Clicked LI dataset:", li.dataset);

  idInput.value      = li.dataset.id      || "";
  firstInput.value   = li.dataset.firstname || "";
  lastInput.value    = li.dataset.lastname  || "";
  cityInput.value    = li.dataset.city      || "";

  resultsUl.innerHTML = "";
});

// === Add relationship row ===
addBtn.addEventListener("click", () => {
  const idVal   = idInput.value.trim();
  const fnVal   = firstInput.value.trim();
  const lnVal   = lastInput.value.trim();
  const relType = document.getElementById("relationType").value;

  if (!idVal || !fnVal || !lnVal || !relType) {
    alert("Συμπλήρωσε όλα τα πεδία για να προσθέσεις μια σχέση.");
    return;
  }
  console.debug("➕ Adding relationship:", { idVal, fnVal, lnVal, relType });

  // remove placeholder row
  const placeholder = relationsTbody.querySelector("td[colspan]");
  if (placeholder) relationsTbody.innerHTML = "";

  const tr     = document.createElement("tr");
  const tdName = document.createElement("td");
  const tdRel  = document.createElement("td");

  // αποθηκεύουμε το ID στο πρώτο κελί
  tdName.dataset.id = idVal;
  tdName.textContent = `${fnVal} ${lnVal}`;
  tdRel.textContent  = relType;

  tr.appendChild(tdName);
  tr.appendChild(tdRel);
  relationsTbody.appendChild(tr);
});
