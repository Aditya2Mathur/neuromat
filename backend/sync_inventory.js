const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase admin client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const suffixes = ['TAB', 'CAP', 'SYP', 'POWDER', 'POWEDER', 'SPRAY', 'GEL', 'PATCH', 'OINTMENT', 'SACHET', 'TABLET', 'TABLATE', 'OIL'];

// Canonicalizes names by converting them to the original suffix-at-the-end format (uppercase)
// e.g. "TAB ADMENTA 5" -> "ADMENTA 5 TAB"
// e.g. "ADMENTA 5 TAB" -> "ADMENTA 5 TAB"
function canonicalize(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    const firstWord = parts[0].toUpperCase().replace(/[^A-Z]/g, '');
    if (suffixes.includes(firstWord)) {
      const kw = parts.shift();
      parts.push(kw);
      return parts.join(' ').toUpperCase();
    }
  }
  return name.trim().toUpperCase();
}

function getMultiplier(pack) {
  if (!pack) return 10;
  const parts = pack.toUpperCase().split('X');
  if (parts.length > 1) {
    const mult = parseInt(parts[parts.length - 1].trim(), 10);
    if (!isNaN(mult)) return mult;
  }
  return 10;
}

function calculateStock(stockStr, pack) {
  if (!stockStr || stockStr === '-') return 0;
  
  if (stockStr.includes(':')) {
    const parts = stockStr.split(':');
    const strips = parseInt(parts[0], 10);
    const tabs = parseInt(parts[1], 10);
    const mult = getMultiplier(pack);
    const sign = parts[0].trim().startsWith('-') ? -1 : 1;
    return strips * mult + sign * tabs;
  } else {
    return parseInt(stockStr, 10) || 0;
  }
}

function determineUnit(name) {
  const upper = name.toUpperCase();
  if (upper.includes('SYP')) return 'syrup';
  if (upper.includes('CAP')) return 'capsule';
  if (upper.includes('PATCH')) return 'patch';
  if (upper.includes('SACHET')) return 'sachet';
  if (upper.includes('GEL') || upper.includes('OINTMENT')) return 'cream';
  if (upper.includes('SPRAY')) return 'drops';
  return 'tablet';
}

function decodeLine(html) {
  return html
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8209;/g, '-');
}

async function syncInventory() {
  console.log('🚀 Running precise sync using canonical name matching...\n');
  
  // 1. Read and parse report.html
  const filePath = path.join(__dirname, '../report.html');
  const htmlContent = fs.readFileSync(filePath, 'utf-8');
  const divRegex = /<div\s+class="font1"[^>]*>([\s\S]*?)<\/div>/gi;
  let match;
  const reportMedicines = [];
  
  while ((match = divRegex.exec(htmlContent)) !== null) {
    const decoded = decodeLine(match[1]);
    const lineRegex = /^(\s*\d+\s{2,})(.{30})([\s\S]*)$/;
    const m = decoded.match(lineRegex);
    
    if (m) {
      const prefix = m[1];
      const nameCol = m[2];
      const suffixRest = m[3];
      
      const serial = parseInt(prefix.trim(), 10);
      const name = nameCol.trim();
      
      if (serial && name) {
        const parts = suffixRest.trim().split(/\s{2,}/);
        const pack = parts[0] ? parts[0].trim() : "";
        const stockStr = parts[1] ? parts[1].trim() : "";
        const unitStr = parts[2] ? parts[2].trim() : "";
        
        const computedStock = calculateStock(stockStr, pack);
        reportMedicines.push({
          serial,
          name,
          pack,
          stockStr,
          computedStock,
          unitStr
        });
      }
    }
  }
  
  console.log(`Parsed ${reportMedicines.length} medicines from report.html.`);
  
  // 2. Fetch all current database medicines
  const { data: dbMedicines, error: dbError } = await supabase
    .from('medicines')
    .select('*');
    
  if (dbError) {
    console.error('❌ Error fetching medicines from database:', dbError);
    return;
  }
  
  console.log(`Fetched ${dbMedicines.length} medicines from public.medicines database table.\n`);
  
  // Create mapping of DB medicines by canonical name
  const dbCanonicalMap = new Map();
  dbMedicines.forEach(med => {
    const canon = canonicalize(med.name);
    if (!dbCanonicalMap.has(canon)) {
      dbCanonicalMap.set(canon, med);
    }
  });
  
  let updatedCount = 0;
  let insertedCount = 0;
  
  // 3. Process each parsed medicine from report
  for (const repMed of reportMedicines) {
    const canon = canonicalize(repMed.name);
    const matchedDbMed = dbCanonicalMap.get(canon);
    
    if (matchedDbMed) {
      const newName = repMed.name;
      const newStock = repMed.computedStock;
      
      const hasNameChanged = matchedDbMed.name !== newName;
      const hasStockChanged = matchedDbMed.stock_quantity !== newStock;
      
      if (hasNameChanged || hasStockChanged) {
        const { error: updateError } = await supabase
          .from('medicines')
          .update({
            name: newName,
            stock_quantity: newStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', matchedDbMed.id);
          
        if (updateError) {
          console.error(`❌ Failed to update medicine ID ${matchedDbMed.id} (${repMed.name}):`, updateError.message);
        } else {
          updatedCount++;
          if (hasNameChanged) {
            console.log(`✅ [UPDATED] S.No ${repMed.serial}: "${matchedDbMed.name}" -> "${newName}" | Stock: ${newStock}`);
            
            // Sync name in prescription_items denormalized column
            const { error: rxError } = await supabase
              .from('prescription_items')
              .update({ medicine_name: newName })
              .eq('medicine_id', matchedDbMed.id);
              
            if (rxError) {
              console.error(`   ⚠️ Failed to update prescription_items name for ID ${matchedDbMed.id}:`, rxError.message);
            }
          } else {
            console.log(`✅ [STOCK SYNC] S.No ${repMed.serial}: "${newName}" | Stock: ${matchedDbMed.stock_quantity} -> ${newStock}`);
          }
        }
      }
    } else {
      // Medicine is missing -> INSERT it (safety check if it doesn't exist under canonical name)
      const newName = repMed.name;
      const newStock = repMed.computedStock;
      const newUnit = determineUnit(newName);
      
      const { data: insertedMed, error: insertError } = await supabase
        .from('medicines')
        .insert({
          name: newName,
          stock_quantity: newStock,
          unit: newUnit,
          category: 'Other',
          low_stock_threshold: 10,
          is_active: true
        })
        .select()
        .single();
        
      if (insertError) {
        console.error(`❌ Failed to insert new medicine "${newName}":`, insertError.message);
      } else {
        insertedCount++;
        console.log(`🆕 [INSERTED] S.No ${repMed.serial}: "${newName}" | Stock: ${newStock} | Unit: ${newUnit}`);
      }
    }
  }
  
  console.log(`\n🎉 Precise sync operations completed:`);
  console.log(`- Medicines updated/synced: ${updatedCount}`);
  console.log(`- New medicines inserted:    ${insertedCount}`);
}

syncInventory().catch(console.error);
