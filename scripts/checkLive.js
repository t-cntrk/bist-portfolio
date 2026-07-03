(async () => {
  const url = 'http://localhost:3100/api/stocks';
  let found = false;
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (text.includes('"source":"yahoo"')) {
        console.log('FOUND yahoo at attempt', i);
        found = true;
        break;
      }
      console.log('attempt', i, 'mock');
    } catch (err) {
      console.error('fetch error', err);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (!found) console.log('no yahoo yet');
})();
