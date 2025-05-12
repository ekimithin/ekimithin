// js/sections/relationships.js
import { supabase } from "../supabase.js";

export function initRelationships(){
  console.debug("[MODULE LOAD]",{module:"relationships.js"});
  const addBtn      = document.getElementById("addRelationshipBtn");
  const resultsList = document.getElementById("relativeResults");
  const table       = document.getElementById("relations-table");
  const inputId     = document.getElementById("relativeIdInput");
  const inputLast   = document.getElementById("relativeLastnameInput");
  const inputFirst  = document.getElementById("relativeFirstnameInput");
  const inputCity   = document.getElementById("relativeCityInput");
  const selectType  = document.getElementById("relationType");
  const noRow       = document.getElementById("noRelationshipsRow");

  if(!addBtn||!resultsList||!table){
    console.warn("[REL INIT] missing elements");
    return;
  }

  let timer;
  [inputId,inputLast,inputFirst,inputCity].forEach(inp=>{
    inp.addEventListener("input",()=>{
      clearTimeout(timer);
      timer=setTimeout(async()=>{
        console.debug("[API CALL START]",{query:"relationships.search",params:{
          id:inputId.value, last:inputLast.value,
          first:inputFirst.value, city:inputCity.value
        }});
        const {data,error}=await supabase
          .from("memorials")
          .select("id,first_name,last_name,city")
          .ilike("id",`%${inputId.value}%`)
          .ilike("last_name",`%${inputLast.value}%`)
          .ilike("first_name",`%${inputFirst.value}%`)
          .ilike("city",`%${inputCity.value}%`)
          .limit(5);
        console.debug("[API CALL RESULT]",{data,error});
        resultsList.innerHTML="";
        if(error||!data) return;
        data.forEach(m=>{
          const li=document.createElement("li");
          li.textContent=`${m.first_name} ${m.last_name} — ${m.city}`;
          li.dataset.id=m.id;
          li.dataset.fn=m.first_name;
          li.dataset.ln=m.last_name;
          resultsList.append(li);
        });
      },300);
    });
  });

  // pick from suggestions
  resultsList.addEventListener("click",e=>{
    if(e.target.tagName!=="LI")return;
    console.debug("[EVENT] select relative",e.target.dataset);
    selectType.dataset.relativeId=e.target.dataset.id;
    selectType.dataset.relativeName=`${e.target.dataset.fn} ${e.target.dataset.ln}`;
    resultsList.innerHTML="";
  });

  // add to table
  addBtn.addEventListener("click",()=>{
    const relId=selectType.dataset.relativeId;
    const relName=selectType.dataset.relativeName;
    const relType=selectType.value;
    if(!relId||!relType){
      alert("επίλεξε συγγενή και τύπο");
      return;
    }
    noRow.style.display="none";
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td data-id="${relId}">${relName}</td>
      <td>${relType}</td>
      <td><button class="deleteBtn">🗑️</button></td>
    `;
    table.querySelector("tbody").append(tr);
    // clear
    [inputId,inputLast,inputFirst,inputCity].forEach(i=>i.value="");
    selectType.value="";
    // delete listener
    tr.querySelector(".deleteBtn").addEventListener("click",()=>{
      tr.remove();
      if(!table.querySelector("tbody tr")) noRow.style.display="";
    });
  });
}
