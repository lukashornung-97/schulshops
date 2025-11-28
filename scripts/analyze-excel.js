const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', '20251121_mirka - bestellung.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log(`Gesamt Zeilen: ${data.length}\n`);

// Sammle alle eindeutigen Schulen
const schools = new Set();
const schoolCounts = new Map();

data.forEach(row => {
  const productTags = row['Line items: Product Tags'] || '';
  const productTitle = row['Line items: Title'] || '';
  
  // Extrahiere Schule aus Tags
  if (productTags) {
    const tags = productTags.split(',').map(t => t.trim());
    tags.forEach(tag => {
      if (tag.length > 3 && /[A-Z]/.test(tag)) {
        schools.add(tag);
        schoolCounts.set(tag, (schoolCounts.get(tag) || 0) + 1);
      }
    });
  }
  
  // Extrahiere Schule aus Produkttitel
  if (productTitle && productTitle.includes('|')) {
    const parts = productTitle.split('|');
    if (parts.length > 1) {
      const schoolPart = parts[parts.length - 1].trim();
      if (schoolPart.length > 3) {
        schools.add(schoolPart);
        schoolCounts.set(schoolPart, (schoolCounts.get(schoolPart) || 0) + 1);
      }
    }
  }
});

console.log('Gefundene Schulen:');
console.log('==================\n');

const sortedSchools = Array.from(schools).sort((a, b) => {
  const countA = schoolCounts.get(a) || 0;
  const countB = schoolCounts.get(b) || 0;
  return countB - countA;
});

sortedSchools.forEach(school => {
  console.log(`${school}: ${schoolCounts.get(school)} Vorkommen`);
});

console.log(`\nGesamt eindeutige Schulen: ${schools.size}`);

// Zeige Beispiel-Zeilen für jede Schule
console.log('\n\nBeispiel-Zeilen pro Schule:');
console.log('============================\n');

sortedSchools.slice(0, 10).forEach(school => {
  const exampleRow = data.find(row => {
    const tags = (row['Line items: Product Tags'] || '').includes(school);
    const title = (row['Line items: Title'] || '').includes(school);
    return tags || title;
  });
  
  if (exampleRow) {
    console.log(`\n${school}:`);
    console.log(`  Product Tags: ${exampleRow['Line items: Product Tags'] || 'N/A'}`);
    console.log(`  Product Title: ${exampleRow['Line items: Title'] || 'N/A'}`);
    console.log(`  Customer: ${exampleRow['Customer: First name'] || ''} ${exampleRow['Customer: Last name'] || ''}`);
  }
});


