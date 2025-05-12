// js/sections/relationships.js

import { supabase } from "../supabase.js";

document.addEventListener("DOMContentLoaded", () => {
  // DOM elements
  const idInput        = document.getElementById("relativeIdInput");
  const lastInput      = document.getElementById("relativeLastnameInput");
  const firstInput     = document.getElementById("relativeFirstnameInput");
  const cityInput      = document.getElementById("relativeCityInput");
  const resultsUl      = document.getElementById("relativeResults");
  const addBtn         = document.getElementById("addRelationshipBtn");
  const relationsTable = document.getElementById("relations-table");
  const relationsTbody = relationsTable.querySelector("tbody");
  let searchTimer;

  // 1) Debounced search
  function searchRelatives() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      try {
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
        if (error) throw error;

        resultsUl.innerHTML = "";
        if (!data.length) {
          resultsUl.innerHTML = `<li>Δεν βρέθηκαν συγγενείς.</li>`;
          return;
        }

        data.forEach(r => {
          const li = document.createElement("li");
          li.textContent        = `${r.id} – ${r.first_name} ${r.last_name} (${r.city})`;
          li.dataset.id         = r.id;
          li.dataset.firstname  = r.first_name;
          li.dataset.lastname   = r.last_name;
          li.dataset.city       = r.city;
          resultsUl.appendChild(li);
        });
      } catch (err) {
        console.error("❌ Relatives search error:", err);
        resultsUl.innerHTML = `<li>Σφάλμα αναζήτησης.</li>`;
      }
    }, 500); // αύξηση debounce για λιγότερα calls
  }

  // hook up search
  [idInput, lastInput, firstInput, cityInput].forEach(el =>
    el.addEventListener("input", searchRelatives)
  );

  // 2) Select a result
  resultsUl.addEventListener("click", e => {
    if (e.target.tagName !== "LI") return;
    const li = e.target;
    console.debug("✅ Selected relative:", li.dataset);
    idInput.value      = li.dataset.id      || "";
    firstInput.value   = li.dataset.firstname || "";
    lastInput.value    = li.dataset.lastname  || "";
    cityInput.value    = li.dataset.city      || "";
    resultsUl.innerHTML = "";
  });

  // 3) Add relationship row (no duplicates + delete button)
  addBtn.addEventListener("click", () => {
    const idVal   = idInput.value.trim();
    const fnVal   = firstInput.value.trim();
    const lnVal   = lastInput.value.trim();
    const relType = document.getElementById("relationType").value;

    if (!idVal || !fnVal || !lnVal || !relType) {
      alert("Συμπλήρωσε όλα τα πεδία για να προσθέσεις μια σχέση.");
      return;
    }

    // Prevent duplicate
    const exists = Array.from(relationsTbody.querySelectorAll("td[data-id]"))
      .some(td => td.dataset.id === idVal);
    if (exists) {
      alert("Αυτή η σχέση υπάρχει ήδη.");
      return;
    }

    console.debug("➕ Adding relationship:", { idVal, fnVal, lnVal, relType });

    // Remove placeholder row, if any
    const placeholder = relationsTbody.querySelector("td[colspan]");
    if (placeholder) relationsTbody.innerHTML = "";

    // Build row
    const tr     = document.createElement("tr");
    const tdName = document.createElement("td");
    const tdRel  = document.createElement("td");
    const tdDel  = document.createElement("td");
    const btnDel = document.createElement("button");

    tdName.dataset.id = idVal;
    tdName.textContent = `${fnVal} ${lnVal}`;
    tdRel.textContent  = relType;

    btnDel.type        = "button";
    btnDel.textContent = "✖️";
    btnDel.addEventListener("click", () => tr.remove());
    tdDel.appendChild(btnDel);

    tr.append(tdName, tdRel, tdDel);
    relationsTbody.appendChild(tr);
  });
});
