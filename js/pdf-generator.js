// js/pdf-generator.js
import { toLatin } from './utils/greekUtils.js';


document.getElementById("generatePdfBtn")?.addEventListener("click", async () => {
  const form = document.getElementById("memorialForm");
  const idRaw = form.dataset.id;
  if (!idRaw || idRaw.startsWith("temp-")) {
    return alert("⚠️ Δεν υπάρχει έγκυρο καταχωρημένο ID.\nΠαρακαλώ πρώτα αποθήκευσε ή επίλεξε ένα memorial.");
  }

  const safeId = toLatin(idRaw);
  const qrUrl = `https://glsayujqzkevokaznnrd.supabase.co/storage/v1/object/public/qr-codes/${encodeURIComponent(safeId)}.png`;

  const data = {
    first_name: form.firstname.value.trim(),
    last_name: form.lastname.value.trim(),
    city: form.city.value.trim(),
    region: form.region.value.trim(),
    id: safeId,
    birth_place: form.birth_place.value.trim(),
    profession: form.profession.value.trim(),
    education: form.education.value.trim(),
    awards: form.awards.value.trim(),
    interests: form.interests.value.trim(),
    cemetery: form.cemetery.value.trim(),
    genealogy: form.genealogy.value.trim()
  };

  const qrBase64 = await fetch(qrUrl)
    .then(res => res.blob())
    .then(blob => new Promise(res => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result);
      reader.readAsDataURL(blob);
    }))
    .catch(() => null);

  const content = [
    { text: "Στοιχεία Καταχώρησης", style: "header", alignment: "center", margin: [0, 0, 0, 20] },
    { text: `Ονοματεπώνυμο: ${data.last_name} ${data.first_name}`, style: "normal" },
    { text: `Τοποθεσία: ${data.city}, ${data.region}`, style: "normal", margin: [0, 0, 0, 10] },
    {
      style: "idBox",
      table: {
        widths: ['*'],
        body: [
          [{ text: `ID Εγγραφής: ${data.id}`, style: "idText" }],
          [{ text: "⚠️ ΠΡΟΣΟΧΗ\nΟ κωδικός καταχώρησης είναι μοναδικός.\nΣας παρακαλούμε να τον φυλάξετε για τυχόν μελλοντικές αλλαγές\nστη Βάση Ψηφιακής Μνήμης.", style: "warning" }]
        ]
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 0,
        hLineColor: () => 'red'
      },
      margin: [0, 0, 0, 15]
    }
  ];

  const labels = {
    birth_place: "Τόπος Γέννησης",
    profession: "Επάγγελμα",
    education: "Εκπαίδευση",
    awards: "Διακρίσεις",
    interests: "Ενδιαφέροντα",
    cemetery: "Κοιμητήριο",
    genealogy: "Γενεαλογικά"
  };

  for (const key in labels) {
    if (data[key]) {
      content.push({ text: `${labels[key]}: ${data[key]}`, style: "normal" });
    }
  }

  if (qrBase64) {
    content.push({ image: qrBase64, width: 150, alignment: "center", margin: [0, 20, 0, 0] });
  } else {
    content.push({ text: "❌ Δεν βρέθηκε QR", color: "red", margin: [0, 20, 0, 0] });
  }

  const docDefinition = {
    content,
    styles: {
      header: { fontSize: 18, bold: true },
      normal: { fontSize: 12 },
      idBox: { margin: [0, 10, 0, 10] },
      idText: { fontSize: 13, bold: true, color: 'red' },
      warning: { fontSize: 10, italics: true, color: 'red' }
    }
  };

  pdfMake.createPdf(docDefinition).download(`mnimeio-${data.id}.pdf`);
});
