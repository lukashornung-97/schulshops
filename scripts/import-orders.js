const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Fehlende Supabase-Umgebungsvariablen!');
  console.error('Bitte stellen Sie sicher, dass NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local gesetzt sind.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Konvertiere Excel-Datum zu ISO-String
function excelDateToISO(excelDate) {
  if (!excelDate) return new Date().toISOString();
  // Excel-Datum ist die Anzahl der Tage seit dem 1. Januar 1900
  const excelEpoch = new Date(1899, 11, 30); // 30. Dezember 1899
  const date = new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

// Extrahiere Schulname aus Product Tags oder Product Title
function extractSchoolName(productTags, productTitle) {
  // PRIORITÄT 1: Versuche zuerst aus Product Tags
  if (productTags) {
    const tags = productTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    // Suche nach vollständigem Schulnamen (enthält Großbuchstaben und sieht wie ein vollständiger Name aus)
    // z.B. "Helfenstein-Gymnasium-Geislingen", "Staatliches Gymnasium Holzkirchen"
    const fullSchoolName = tags.find(tag => 
      tag.length > 10 && 
      /[A-Z]/.test(tag) && 
      (tag.includes('-') || tag.includes(' ') || tag.includes('Gymnasium') || tag.includes('Schule') || tag.includes('Gym'))
    );
    if (fullSchoolName) {
      return fullSchoolName;
    }
    
    // Falls kein vollständiger Name gefunden, nimm den längsten Tag mit Großbuchstaben
    const tagsWithCapital = tags.filter(tag => /[A-Z]/.test(tag) && tag.length > 3);
    if (tagsWithCapital.length > 0) {
      // Sortiere nach Länge (längster zuerst)
      tagsWithCapital.sort((a, b) => b.length - a.length);
      return tagsWithCapital[0];
    }
    
    // Falls nur Kleinbuchstaben-Tags vorhanden sind, nimm den längsten
    // Diese werden später beim Matching verwendet
    if (tags.length > 0) {
      tags.sort((a, b) => b.length - a.length);
      return tags[0];
    }
  }
  
  // PRIORITÄT 2: Falls nicht gefunden, versuche aus Product Title zu extrahieren
  if (productTitle && productTitle.includes('|')) {
    const parts = productTitle.split('|');
    if (parts.length > 1) {
      const schoolPart = parts[parts.length - 1].trim();
      if (schoolPart.length > 3) {
        return schoolPart;
      }
    }
  }
  
  return null;
}

// Normalisiere String für Vergleich (lowercase, trim)
function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase().trim();
}

// Extrahiere alle Product Tags als Array
function extractAllProductTags(productTags) {
  if (!productTags) return [];
  return productTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
}

// Finde Schule anhand von Product Tags (matcht zuerst auf short_code)
async function findSchoolByProductTags(schools, productTags) {
  if (!productTags) return null;
  
  const tags = extractAllProductTags(productTags);
  if (tags.length === 0) return null;
  
  // PRIORITÄT 1: Versuche exaktes Matching mit short_code
  for (const tag of tags) {
    const normalizedTag = normalizeString(tag);
    const school = schools.find(s => 
      s.short_code && normalizeString(s.short_code) === normalizedTag
    );
    if (school) {
      console.log(`✓ Schule gefunden via short_code: ${school.name} (Tag: ${tag})`);
      return school;
    }
  }
  
  // PRIORITÄT 2: Versuche Teilübereinstimmung mit short_code
  for (const tag of tags) {
    const normalizedTag = normalizeString(tag);
    const school = schools.find(s => 
      s.short_code && normalizeString(s.short_code).includes(normalizedTag)
    );
    if (school) {
      console.log(`✓ Schule gefunden via short_code (Teilübereinstimmung): ${school.name} (Tag: ${tag})`);
      return school;
    }
  }
  
  return null;
}

// Finde Schule in der Datenbank (fuzzy matching)
async function findOrCreateSchool(schools, schoolIdentifier, productTags = null) {
  if (!schoolIdentifier && !productTags) return null;
  
  // PRIORITÄT 1: Versuche zuerst Product Tags mit short_code zu matchen
  if (productTags) {
    const schoolByTags = await findSchoolByProductTags(schools, productTags);
    if (schoolByTags) return schoolByTags;
  }
  
  // PRIORITÄT 2: Falls schoolIdentifier vorhanden, versuche damit zu matchen
  if (schoolIdentifier) {
    const normalizedSearch = normalizeString(schoolIdentifier);
    
    // Exakte Übereinstimmung mit Name oder short_code
    let school = schools.find(s => 
      normalizeString(s.name) === normalizedSearch ||
      (s.short_code && normalizeString(s.short_code) === normalizedSearch)
    );
    
    if (school) return school;
    
    // Teilübereinstimmung im Namen
    school = schools.find(s => {
      const normalizedSchoolName = normalizeString(s.name);
      return normalizedSchoolName.includes(normalizedSearch) || 
             normalizedSearch.includes(normalizedSchoolName);
    });
    
    if (school) return school;
    
    // Suche nach Teilen des Namens
    const parts = normalizedSearch.split(/\s+/).filter(p => p.length > 3);
    for (const part of parts) {
      school = schools.find(s => normalizeString(s.name).includes(part));
      if (school) return school;
    }
  }
  
  // Schule nicht gefunden - erstelle sie
  // Verwende schoolIdentifier als Namen, oder extrahiere aus Product Tags
  let schoolName = schoolIdentifier;
  let shortCode = null;
  
  if (productTags) {
    const tags = extractAllProductTags(productTags);
    
    // Finde short_code: kurzer Tag ohne Großbuchstaben oder mit wenigen Zeichen
    const codeTag = tags.find(tag => 
      tag.length <= 15 && 
      (!/[A-Z]/.test(tag) || tag.length <= 10)
    );
    if (codeTag) {
      shortCode = codeTag;
    }
    
    // Finde Schulname aus Tags: langer Tag mit Großbuchstaben
    if (!schoolName) {
      const nameTag = tags.find(tag => 
        /[A-Z]/.test(tag) && 
        (tag.length > 10 || tag.includes('Gymnasium') || tag.includes('Schule'))
      );
      if (nameTag) {
        schoolName = nameTag;
      } else if (tags.length > 0) {
        // Fallback: nimm den längsten Tag
        tags.sort((a, b) => b.length - a.length);
        schoolName = tags[0];
      }
    }
  }
  
  if (!schoolName) return null;
  
  console.log(`📝 Erstelle neue Schule: ${schoolName}${shortCode ? ` (Code: ${shortCode})` : ''}`);
  const { data: newSchool, error: createError } = await supabase
    .from('schools')
    .insert([{
      name: schoolName,
      short_code: shortCode,
      status: 'existing',
    }])
    .select()
    .single();
  
  if (createError) {
    console.error(`❌ Fehler beim Erstellen der Schule ${schoolName}:`, createError.message);
    return null;
  }
  
  // Füge zur Liste hinzu für zukünftige Lookups
  schools.push(newSchool);
  return newSchool;
}

async function importOrders() {
  try {
    // Lade Excel-Datei
    const filePath = path.join(__dirname, '..', '20251121_mirka - bestellung.xlsx');
    console.log('Lade Excel-Datei:', filePath);
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Konvertiere zu JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`\nGefundene Zeilen: ${data.length}`);
    console.log('Erste Zeile als Beispiel:');
    console.log(JSON.stringify(data[0], null, 2));
    
    // Lade alle Schulen und Shops
    console.log('\nLade Schulen und Shops...');
    const { data: schools, error: schoolsError } = await supabase
      .from('schools')
      .select('id, name, short_code');
    
    if (schoolsError) throw schoolsError;
    
    const { data: shops, error: shopsError } = await supabase
      .from('shops')
      .select('id, school_id, name');
    
    if (shopsError) throw shopsError;
    
    console.log(`Gefundene Schulen: ${schools?.length || 0}`);
    schools?.forEach(s => console.log(`  - ${s.name}${s.short_code ? ` (${s.short_code})` : ''}`));
    console.log(`Gefundene Shops: ${shops?.length || 0}`);
    
    // Gruppiere Bestellungen nach Bestellnummer (Name-Spalte)
    console.log('\nGruppiere Bestellungen...');
    const ordersMap = new Map();
    
    for (const row of data) {
      const orderNumber = row['Name']; // z.B. "#2016"
      if (!orderNumber) continue;
      
      if (!ordersMap.has(orderNumber)) {
        ordersMap.set(orderNumber, {
          orderNumber,
          items: [],
          schoolName: null,
          schoolNameFromTitle: null, // Vollständiger Name aus Product Title
          customerFirstName: row['Customer: First name'] || '',
          customerLastName: row['Customer: Last name'] || '',
          email: row['Email'] || '',
          className: row['Line items: Custom attributes Klasse'] || '',
          createdAt: row['Created at'],
        });
      }
      
      const order = ordersMap.get(orderNumber);
      
      // Sammle Product Tags aus allen Items dieser Bestellung
      const productTags = row['Line items: Product Tags'] || '';
      const productTitle = row['Line items: Title'] || '';
      
      // Speichere Product Tags für späteres Matching
      if (productTags && !order.allProductTags) {
        order.allProductTags = [];
      }
      if (productTags && !order.allProductTags.includes(productTags)) {
        order.allProductTags.push(productTags);
      }
      
      // Extrahiere vollständigen Schulnamen aus Product Title (nach |)
      if (productTitle && productTitle.includes('|')) {
        const parts = productTitle.split('|');
        if (parts.length > 1) {
          const schoolPart = parts[parts.length - 1].trim();
          if (schoolPart.length > 5 && /[A-Z]/.test(schoolPart)) {
            if (!order.schoolNameFromTitle || schoolPart.length > order.schoolNameFromTitle.length) {
              order.schoolNameFromTitle = schoolPart;
            }
          }
        }
      }
      
      // Extrahiere Schulname aus Product Tags (für Fallback)
      if (!order.schoolName) {
        order.schoolName = extractSchoolName(productTags, productTitle);
      }
      
      // Füge Item hinzu
      order.items.push({
        title: row['Line items: Title'] || '',
        variant: row['Line items: Variant title'] || '',
        quantity: parseInt(row['Line items: Quantity'] || 1),
        productTags: productTags,
      });
    }
    
    console.log(`Gefundene eindeutige Bestellungen: ${ordersMap.size}`);
    
    // Importiere Bestellungen
    console.log('\nBeginne Import...');
    let imported = 0;
    let skipped = 0;
    const errors = [];
    const schoolStats = new Map();
    
    for (const [orderNumber, orderData] of ordersMap) {
      try {
        // Finde oder erstelle Schule
        // Kombiniere alle Product Tags zu einem String für Matching
        const combinedProductTags = orderData.allProductTags ? orderData.allProductTags.join(', ') : '';
        
        // Verwende vollständigen Namen aus Product Title falls verfügbar, sonst schoolName
        const schoolNameToUse = orderData.schoolNameFromTitle || orderData.schoolName;
        
        // Versuche zuerst mit Product Tags zu matchen (matcht auf short_code)
        let school = await findOrCreateSchool(
          schools || [], 
          schoolNameToUse, 
          combinedProductTags
        );
        
        if (!school) {
          console.warn(`⚠️  Schule nicht gefunden/erstellt für: "${orderData.schoolName}" (Bestellung: ${orderNumber})`);
          if (orderData.allProductTags && orderData.allProductTags.length > 0) {
            console.warn(`   Verfügbare Product Tags: ${orderData.allProductTags.join(', ')}`);
          }
          skipped++;
          continue;
        }
        
        // Finde oder erstelle Shop für diese Schule
        let shop = shops?.find(s => s.school_id === school.id);
        if (!shop) {
          console.log(`📝 Erstelle Shop für Schule: ${school.name}`);
          const shopName = `Shop ${school.name}`;
          const shopSlug = school.name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          
          const { data: newShop, error: shopError } = await supabase
            .from('shops')
            .insert([{
              school_id: school.id,
              name: shopName,
              slug: `${shopSlug}-${Date.now()}`,
              status: 'live',
              currency: 'EUR',
            }])
            .select()
            .single();
          
          if (shopError) {
            console.error(`❌ Fehler beim Erstellen des Shops für ${school.name}:`, shopError.message);
            skipped++;
            continue;
          }
          
          shop = newShop;
          shops.push(shop);
        }
        
        // Berechne Gesamtbetrag (vereinfacht: 0, da keine Preise in Excel)
        const totalAmount = 0; // TODO: Preise aus Excel extrahieren falls vorhanden
        
        // Erstelle Kundennamen
        const customerName = `${orderData.customerFirstName} ${orderData.customerLastName}`.trim();
        if (!customerName) {
          console.warn(`⚠️  Kein Kundename gefunden (Bestellung: ${orderNumber})`);
          skipped++;
          continue;
        }
        
        // Erstelle Order
        const orderInsert = {
          shop_id: shop.id,
          customer_name: customerName,
          customer_email: orderData.email || null,
          class_name: orderData.className || null,
          status: 'paid', // Annahme: Excel-Daten sind bereits bezahlt
          total_amount: totalAmount,
          created_at: excelDateToISO(orderData.createdAt),
        };
        
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert([orderInsert])
          .select()
          .single();
        
        if (orderError) {
          console.error(`❌ Fehler beim Erstellen der Bestellung ${orderNumber}:`, orderError.message);
          errors.push({ orderNumber, error: orderError.message });
          skipped++;
          continue;
        }
        
        imported++;
        
        // Statistiken
        const schoolName = school.name;
        schoolStats.set(schoolName, (schoolStats.get(schoolName) || 0) + 1);
        
        if (imported % 50 === 0) {
          console.log(`✓ ${imported} Bestellungen importiert...`);
        }
        
      } catch (error) {
        console.error(`❌ Fehler bei Bestellung ${orderNumber}:`, error.message);
        errors.push({ orderNumber, error: error.message });
        skipped++;
      }
    }
    
    console.log('\n=== Import abgeschlossen ===');
    console.log(`✓ Erfolgreich importiert: ${imported}`);
    console.log(`⚠️  Übersprungen: ${skipped}`);
    console.log(`❌ Fehler: ${errors.length}`);
    
    console.log('\n=== Statistiken nach Schule ===');
    for (const [schoolName, count] of schoolStats.entries()) {
      console.log(`  ${schoolName}: ${count} Bestellungen`);
    }
    
    if (errors.length > 0 && errors.length <= 20) {
      console.log('\nFehlerdetails:');
      errors.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err.orderNumber}: ${err.error}`);
      });
    } else if (errors.length > 20) {
      console.log(`\n${errors.length} Fehler aufgetreten. Erste 10:`);
      errors.slice(0, 10).forEach((err, idx) => {
        console.log(`${idx + 1}. ${err.orderNumber}: ${err.error}`);
      });
    }
    
  } catch (error) {
    console.error('Fataler Fehler:', error);
    process.exit(1);
  }
}

importOrders();

