#!/usr/bin/env node

/**
 * Debug script to verify environment variables are loading correctly
 * Run: node debug-env.js
 */

require('dotenv').config();

console.log('\n🔍 Environment Variables Check:\n');

const vars = {
  'POS_V2_API_URL': process.env.POS_V2_API_URL,
  'POS_V2_API_KEY': process.env.POS_V2_API_KEY,
  'SUPPLIER_API_URL': process.env.SUPPLIER_API_URL,
  'AUTH_API_URL': process.env.AUTH_API_URL,
  'MONGODB_URI': process.env.MONGODB_URI,
  'REDIS_URL': process.env.REDIS_URL,
};

Object.entries(vars).forEach(([key, value]) => {
  if (!value) {
    console.log(`❌ ${key}: NOT SET`);
  } else if (key.includes('KEY') || key.includes('SECRET') || key.includes('URI')) {
    // Mask sensitive values
    const masked = value.substring(0, 20) + '...' + value.substring(value.length - 10);
    console.log(`✅ ${key}: ${masked} (length: ${value.length})`);
  } else {
    console.log(`✅ ${key}: ${value}`);
  }
});

console.log('\n📋 POS V2 API Key Analysis:\n');

if (process.env.POS_V2_API_KEY) {
  const key = process.env.POS_V2_API_KEY;
  
  console.log(`Length: ${key.length} characters`);
  console.log(`Starts with: ${key.substring(0, 25)}...`);
  console.log(`Ends with: ...${key.substring(key.length - 10)}`);
  
  // Check format
  const checks = [
    { name: 'Has "appzap" prefix', pass: key.startsWith('appzap_') },
    { name: 'Has "pos" in name', pass: key.includes('_pos_') },
    { name: 'Has "sk_" (secret key)', pass: key.includes('_sk_') },
    { name: 'Has "live" or "test"', pass: key.includes('_live_') || key.includes('_test_') },
    { name: 'Length >= 60 chars', pass: key.length >= 60 },
    { name: 'No spaces', pass: !key.includes(' ') },
    { name: 'No quotes', pass: !key.includes('"') && !key.includes("'") },
  ];
  
  console.log('\n✅ Format Validation:');
  checks.forEach(check => {
    console.log(`  ${check.pass ? '✅' : '❌'} ${check.name}`);
  });
  
  // Determine key type
  console.log('\n🔑 Key Type:');
  if (key.includes('_live_')) {
    console.log('  📍 Production/Live Key');
  } else if (key.includes('_test_')) {
    console.log('  📍 Test/Sandbox Key');
  } else {
    console.log('  ⚠️  Unknown key type');
  }
  
} else {
  console.log('❌ POS_V2_API_KEY is not set!');
}

console.log('\n');

