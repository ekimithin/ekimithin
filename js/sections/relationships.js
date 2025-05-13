// js/sections/relationships.js
import { supabase } from '../supabase.js';

// 🔗 Αντιστοίχιση σχέσης με την αντίστροφη
const reverseRelationMap = {
  "Πατέρας": "Παιδί",
  "Μητέρα": "Παιδί",
  "Γονέας": "Παιδί",
  "Παιδί": "Γονέας",
  "Αδελφός": "Αδελφός/ή",
  "Αδελφή": "Αδελφός/ή",
  "Αδελφός/ή": "Αδελφός/ή",
  "Θείος": "Ανιψιός/ή",
  "Θεία": "Ανιψιός/ή",
  "Ανιψιός": "Θείος/Θεία",
  "Ανιψιά": "Θείος/Θεία",
  "Ανιψιός/ή": "Θείος/Θεία",
  "Ξάδερφος": "Ξάδερφος/η",
  "Ξαδέρφη": "Ξάδερφος/η",
  "Ξάδερφος/η": "Ξάδερφος/η"
};

// DOM στοιχεία
const idInput        = document.getElementById('relativeIdInput');
const lnameInput     = document.getElementById('relativeLastnameInput');
const fnameInput     = document.getElementById('relativeFirstnameInput');
const cityInput      = document.getElementById('relativeCityInput');
const resultsList    = document.getElementById('relativeResults');
const addBtn         = document.getElementById('addRelationshipBtn');
const relationSelect = document.getElementById('relationType');
const tableBody      = document.querySelector('#relationshipsTable tbody');

let selectedRelative = null;

// 🔍 Live αναζήτηση memorials
[idInput, lnameInput, fnameInput, cityInput].forEach(el => {
  el.addEventListener('input', debounce(performSearch, 300));
});

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

  if (filters.id)    query = query.ilike('id', `%${filters.id}%`);
  if (filters.last)  query = query.ilike('last_name', `%${filters.last}%`);
  if (filters.first) query = query.ilike('first_name', `%${filters.first}%`);
  if (filters.city)  query = query.ilike('city', `%${filters.city}%`);

  const { data, error } = await query;
  if (error) return console.error(error);

  renderResults(data);
}

function renderResults(items) {
  resultsList.innerHTML = items.map(item => `
    <li data-id="${item.id}" data-name="${item.first_name} ${item.last_name}">
      ${item.id} – ${item.first_name} ${item.last_name} (${item.city})
    </li>
  `).join('');
}

// ✔️ Επιλογή συγγενούς από λίστα
resultsList.addEventListener('click', e => {
  if (e.target.tagName !== 'LI') return;
  selectedRelative = {
    id: e.target.dataset.id,
    name: e.target.dataset.name
  };
  [...resultsList.children].forEach(li => li.classList.remove('selected'));
  e.target.classList.add('selected');
});

// ➕ Προσθήκη σχέσης (και αντίστροφης μόνο αν υπάρχει memorial) στον πίνακα και στη βάση
addBtn.addEventListener('click', async () => {
  if (!selectedRelative) {
    return alert('Διάλεξε πρώτα έναν συγγενή από τα αποτελέσματα.');
  }

  const relation = relationSelect.value;
  if (!relation) {
    return alert('Επίλεξε τύπο σχέσης.');
  }

  const currentMemorialId = document.getElementById('memorialForm')?.dataset?.id;
  if (!currentMemorialId) {
    return alert('Δεν υπάρχει ενεργό memorial για σύνδεση.');
  }

  // ✅ Ενημέρωση πίνακα (θα σταλούν με submit από admin.js)
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${relation}<input type="hidden" name="relationships[][relation]" value="${relation}"></td>
    <td>${selectedRelative.name}<small>${selectedRelative.id}</small>
      <input type="hidden" name="relationships[][relative_id]" value="${selectedRelative.id}">
    </td>
    <td><button type="button" class="remove-relationship">✖️</button></td>
  `;
  tr.querySelector('.remove-relationship').addEventListener('click', () => tr.remove());
  tableBody.appendChild(tr);

  // 🔁 Αν υπάρχει τελικό ID (όχι προσωρινό), κάνε άμεσο upsert διπλής εγγραφής
  const isFinalId = !currentMemorialId.startsWith('temp-');
  if (isFinalId) {
    const inverse = reverseRelationMap[relation] || 'Συγγενής';
    const { error } = await supabase.from('relationships').upsert([
      { memorial_id: currentMemorialId, relative_id: selectedRelative.id, relation_type: relation },
      { memorial_id: selectedRelative.id, relative_id: currentMemorialId, relation_type: inverse }
    ]);
    if (error) {
      console.error('❌ Σφάλμα σχέσης:', error.message);
      return alert('Σφάλμα κατά την αποθήκευση της σχέσης.');
    }
  }

  // Καθάρισμα
  selectedRelative = null;
  resultsList.innerHTML = '';
  [idInput, lnameInput, fnameInput, cityInput].forEach(i => i.value = '');
});

// 🕒 debounce για πιο σταθερό search
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
