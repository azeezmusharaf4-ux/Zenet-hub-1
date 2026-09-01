async function test() {
  const prodUrl = 'https://ais-pre-ofaspsxklysr5eho7ctdrq-162958507994.europe-west3.run.app';
  console.log('Testing Shared/Production URL:', prodUrl);

  try {
    const rHealth = await fetch(prodUrl + '/api/health');
    console.log('/api/health status:', rHealth.status, await rHealth.text());
  } catch (e) {
    console.log('/api/health err:', e.message);
  }

  try {
    const rCountries = await fetch(prodUrl + '/api/onegridhub/countries?server=all1');
    console.log('/api/onegridhub/countries status:', rCountries.status);
    const text = await rCountries.text();
    console.log('/api/onegridhub/countries response (first 200 chars):', text.slice(0, 200));
  } catch (e) {
    console.log('/api/onegridhub/countries err:', e.message);
  }

  try {
    const rBoost = await fetch(prodUrl + '/api/social-boost/services');
    console.log('/api/social-boost/services status:', rBoost.status);
    const text = await rBoost.text();
    console.log('/api/social-boost/services response (first 200 chars):', text.slice(0, 200));
  } catch (e) {
    console.log('/api/social-boost/services err:', e.message);
  }
}
test();
