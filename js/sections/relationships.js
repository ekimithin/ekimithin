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

  // Live search
  let timer;
  [inputId, inputLast, inputFirst, inputCity].forEach(inp=>{
    inp.addEventListener("input",()=>{
      clearTimeout(timer);
      timer = setTimeout(async()=>{
        const { data, error } = await supabase
          .from("memorials")
          .select("id, first_name, last_name, city")
          .ilike("id",`%${inputId.value}%`)
          .ilike("last_name",`%${inputLast.value}%`)
          .ilike("first_name",`%${inputFirst.value}%`)
          .ilike("city",`%${inputCity.value}%`)
          .limit(5);
        resultsList.innerHTML="";
        if(error||!data) return;
        data.forEach(m=>{
          const li=document.createElement("li");
          li.textContent = `${m.first_name} ${m.last_name} — ${m.city}`;
          li.dataset.id  = m.id;
          li.dataset.fn  = m.first_name;
          li.dataset.ln  = m.last_name;
          resultsList.append(li);
        });
      },300);
    });
  });

  // select from list
  resultsList.addEventListener("click",e=>{
    if(e.target.tagName!=="LI") return;
    selectType.value="";
    selectType.dataset.relativeId   = e.target.dataset.id;
    selectType.dataset.relativeName = `${e.target.dataset.fn} ${e.target.dataset.ln}`;
    resultsList.innerHTML="";
  });

  // add relationship
  addBtn.addEventListener("click",()=>{
    const rid  = selectType.dataset.relativeId;
    const name = selectType.dataset.relativeName;
    const rel  = selectType.value;
    if(!rid||!rel){ alert("Επίλεξε συγγενή & τύπο σχέσης"); return; }
    noRow.style.display="none";
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td data-id="${rid}">${name}</td>
      <td>${rel}</td>
      <td><button class="deleteBtn">🗑️</button></td>
    `;
    tableBody.append(tr);
    tr.querySelector(".deleteBtn").addEventListener("click",()=>{
      tr.remove();
      if(!tableBody.querySelector("tr")) noRow.style.display="";
    });
    inputId.value = inputLast.value = inputFirst.value = inputCity.value = "";
    selectType.value = "";
  });
}
