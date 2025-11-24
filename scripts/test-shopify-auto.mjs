#!/usr/bin/env node

/**
 * Automatischer Shopify Verbindungstest
 * Liest Credentials aus .env.local und testet die Verbindung
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Lese .env.local Datei
function loadEnvFile() {
  const envPath = join(__dirname, '..', '.env.local');
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    const env = {};
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    });
    
    return env;
  } catch (error) {
    console.error('❌ Fehler beim Lesen von .env.local:', error.message);
    return null;
  }
}

// Teste Shopify Verbindung
async function testConnection(shopDomain, accessToken) {
  const apiUrl = 'http://localhost:3000/api/shopify/test-connection';
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shopDomain,
        accessToken,
      }),
    });

    const data = await response.json();
    return { success: response.ok, data };
  } catch (error) {
    return { 
      success: false, 
      data: { error: `Verbindungsfehler: ${error.message}` } 
    };
  }
}

// Hauptfunktion
async function main() {
  console.log('🔍 Automatischer Shopify Verbindungstest\n');
  
  // Lade Umgebungsvariablen
  const env = loadEnvFile();
  if (!env) {
    console.log('💡 Tipp: Erstellen Sie eine .env.local Datei mit:');
    console.log('   SHOPIFY_SHOP_DOMAIN=ihr-shop.myshopify.com');
    console.log('   SHOPIFY_ACCESS_TOKEN=shpat_...\n');
    process.exit(1);
  }

  // Hole Credentials
  const shopDomain = 
    env.SHOPIFY_SHOP_DOMAIN || 
    env.NEXT_PUBLIC_SHOPIFY_SHOP_DOMAIN ||
    process.env.SHOPIFY_SHOP_DOMAIN;
    
  const accessToken = 
    env.SHOPIFY_ACCESS_TOKEN || 
    env.NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN ||
    process.env.SHOPIFY_ACCESS_TOKEN;

  if (!shopDomain || !accessToken) {
    console.log('❌ Fehlende Credentials in .env.local');
    console.log('\nBitte fügen Sie hinzu:');
    console.log('SHOPIFY_SHOP_DOMAIN=ihr-shop.myshopify.com');
    console.log('SHOPIFY_ACCESS_TOKEN=shpat_...\n');
    process.exit(1);
  }

  console.log(`📋 Shop Domain: ${shopDomain}`);
  console.log(`🔑 Token beginnt mit: ${accessToken.substring(0, 10)}...`);
  console.log('\n⏳ Teste Verbindung...\n');

  // Prüfe ob Server läuft
  try {
    const healthCheck = await fetch('http://localhost:3000');
    if (!healthCheck.ok) {
      throw new Error('Server antwortet nicht');
    }
  } catch (error) {
    console.log('❌ Next.js Server läuft nicht auf Port 3000');
    console.log('💡 Starten Sie den Server mit: npm run dev\n');
    process.exit(1);
  }

  // Teste Verbindung
  const result = await testConnection(shopDomain, accessToken);

  if (result.success && result.data.success) {
    console.log('✅ Verbindung erfolgreich!\n');
    if (result.data.shop) {
      console.log(`   Shop Name: ${result.data.shop.name}`);
      console.log(`   Domain: ${result.data.shop.domain}`);
      if (result.data.shop.plan) {
        console.log(`   Plan: ${result.data.shop.plan}`);
      }
    }
    console.log(`\n   ${result.data.message || 'Verbindung funktioniert!'}\n`);
    process.exit(0);
  } else {
    console.log('❌ Verbindung fehlgeschlagen\n');
    
    if (result.data.error) {
      console.log(`   Fehler: ${result.data.error}\n`);
    }
    
    if (result.data.troubleshooting) {
      const t = result.data.troubleshooting;
      console.log('   Mögliche Ursachen:');
      t.possibleCauses?.forEach((cause, i) => {
        console.log(`   ${i + 1}. ${cause}`);
      });
      console.log('');
      
      if (t.howToCreateToken) {
        console.log('   So erstellen Sie einen Token:');
        Object.values(t.howToCreateToken).forEach((step, i) => {
          console.log(`   ${i + 1}. ${step}`);
        });
        console.log('');
      }
    }
    
    if (result.data.details) {
      console.log('   Details:', result.data.details);
    }
    
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Unerwarteter Fehler:', error);
  process.exit(1);
});

