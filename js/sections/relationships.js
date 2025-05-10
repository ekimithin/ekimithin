// js/sections/relationships.js
import { supabase } from '../supabase.js';

const idInput        = document.getElementById('relativeIdInput');
const lnameInput     = document.getElementById('relativeLastnameInput');
const fnameInput     = document.getElementById('relativeFirstnameInput');
const cityInput      = document.getElementById('relativeCityInput');
const resultsList    = document.getElementById('relativeResults');
const addBtn         = document.getElementById('addRelationshipBtn');
const relationSelect = document.getElementById('relationType');
const tableBody      = document.querySelector('#relationshipsTable tbody');

let selectedRelative = null;

// Debounce helper
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// 1) Όταν πληκτρολογείς σε οποιοδήποτε φίλτρο αναζήτησης
[idInput, lnameInput, fnameInput, cityInput]
  .forEach(el => el.addEventListener('input', debounce(performSearch, 300)));

async function performSearch() {
  const filters = {
    id:    idInput.value.trim(),
    last:  lnameInput.value.trim(),
    first: fnameInput.value.trim(),
    city:  cityInput.value.trim(),
  };

  let query = supabase
    .from('memorials')
    .select('id, first_name, last_name, city')
    .limit(10);

  if (filters.id)    query = query.ilike('id',         `%${filters.id}%`);
  if (filters.last)  query = query.ilike('last_name',  `%${filters.last}%`);
  if (filters.first) query = query.ilike('first_name', `%${filters.first}%`);
  if (filters.city)  query = query.ilike('city',       `%${filters.city}%`);

  const { data, error } = await query;
  if (error) {
    console.error('Relationships search error:', error);
    return;
  }
  renderResults(data);
}

function renderResults(items) {
  resultsList.innerHTML = items
    .map(item => `
      <li data-id="${item.id}"
          data-name="${item.first_name} ${item.last_name}">
        ${item.id} – ${item.first_name} ${item.last_name}
        <small>(${item.city})</small>
      </li>
    `).join('');
}

// 2) Επιλογή συγγενούς
resultsList.addEventListener('click', e => {
  if (e.target.tagName !== 'LI') return;
  selectedRelative = {
    id:   e.target.dataset.id,
    name: e.target.dataset.name
  };
  // highlight
  Array.from(resultsList.children).forEach(li => li.classList.remove('selected'));
  e.target.classList.add('selected');
});

// 3) Προσθήκη σχέσης στο πίνακα
addBtn.addEventListener('click', () => {
  if (!selectedRelative) {
    alert('Διάλεξε πρώτα έναν συγγενή από τη λίστα.');
    return;
  }
  const relation = relationSelect.value;
  if (!relation) {
    alert('Επίλεξε τύπο σχέσης.');
    return;
  }

  // Δημιουργώ τη σειρά στον πίνακα
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      ${relation}
      <input type="hidden" name="relationships[][relation]" value="${relation}">
    </td>
    <td>
      ${selectedRelative.name}
      <small>${selectedRelative.id}</small>
      <input type="hidden" name="relationships[][relative_id]" value="${selectedRelative.id}">
    </td>
    <td>
      <button type="button" class="remove-relationship">✖️</button>
    </td>
  `;
  tableBody.appendChild(tr);

  // Διαγραφή γραμμής
  tr.querySelector('.remove-relationship').addEventListener('click', () => tr.remove());

  // Καθάρισμα επιλογών
  selectedRelative = null;
  resultsList.innerHTML = '';
  [idInput, lnameInput, fnameInput, cityInput].forEach(i => i.value = '');
});
