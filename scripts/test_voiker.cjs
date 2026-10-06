const fs = require('fs');

async function test() {
  try {
    const res = await fetch('https://voiker.com/order', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const text = await res.text();
    console.log('Status:', res.status, 'Length:', text.length);

    // Search for API documentation links or script sources
    const scripts = [...text.matchAll(/src=["'](.*?)["']/g)].map(m => m[1]);
    console.log('Script sources:', scripts);

    // Search for API links in text
    const links = [...text.matchAll(/href=["'](.*?)["']/g)].map(m => m[1]);
    console.log('Links with api/order/docs/services:', links.filter(l => /api|order|doc|service/i.test(l)));

    // Look for any embedded JSON or config
    const jsonMatches = [...text.matchAll(/<script[^>]*>(.*?)<\/script>/gs)];
    for (const m of jsonMatches) {
      if (/api/i.test(m[1])) {
        console.log('Script containing api keyword (first 300 chars):', m[1].slice(0, 300));
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
