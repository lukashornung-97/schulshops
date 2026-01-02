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

async function deleteAllOrders() {
  try {
    console.log('Lösche alle Bestellungen...\n');

    // Zuerst lösche alle Order Items (wegen Foreign Key Constraints)
    console.log('1. Lösche Order Items...');
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('id');

    if (itemsError) {
      console.error('Fehler beim Laden der Order Items:', itemsError);
      throw itemsError;
    }

    if (orderItems && orderItems.length > 0) {
      const { error: deleteItemsError } = await supabase
        .from('order_items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using a condition that's always true)

      if (deleteItemsError) {
        console.error('Fehler beim Löschen der Order Items:', deleteItemsError);
        throw deleteItemsError;
      }
      console.log(`   ✓ ${orderItems.length} Order Items gelöscht`);
    } else {
      console.log('   ✓ Keine Order Items vorhanden');
    }

    // Dann lösche alle Orders
    console.log('\n2. Lösche Orders...');
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id');

    if (ordersError) {
      console.error('Fehler beim Laden der Orders:', ordersError);
      throw ordersError;
    }

    if (orders && orders.length > 0) {
      const { error: deleteOrdersError } = await supabase
        .from('orders')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteOrdersError) {
        console.error('Fehler beim Löschen der Orders:', deleteOrdersError);
        throw deleteOrdersError;
      }
      console.log(`   ✓ ${orders.length} Orders gelöscht`);
    } else {
      console.log('   ✓ Keine Orders vorhanden');
    }

    console.log('\n✅ Alle Bestellungen erfolgreich gelöscht!');
  } catch (error) {
    console.error('\n❌ Fehler beim Löschen:', error);
    process.exit(1);
  }
}

deleteAllOrders();












