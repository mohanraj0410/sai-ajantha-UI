async function testImages() {
  const routes = ["http://127.0.0.1:3000/", "http://127.0.0.1:3000/products"];
  let checked = 0;
  let broken = 0;
  const verifiedUrls = new Set();

  for (const r of routes) {
    const res = await fetch(r);
    const html = await res.text();
    const matches = html.match(/src="([^"]+)"/g) || [];
    for (const m of matches) {
      let src = m.replace('src="', "").replace('"', "");
      src = src.replaceAll("&amp;", "&");
      if (src.startsWith("/") && !verifiedUrls.has(src)) {
        verifiedUrls.add(src);
        const url = `http://127.0.0.1:3000${src}`;
        const imgRes = await fetch(url);
        checked++;
        if (imgRes.status !== 200) {
          console.error(`Broken image: ${url} (HTTP ${imgRes.status})`);
          broken++;
        }
      }
    }
  }
  console.log(`Verified unique image URLs: ${checked}`);
  console.log(`Broken images (404/500): ${broken}`);
  if (broken > 0) {
    process.exit(1);
  }
}

testImages().catch((err) => {
  console.error(err);
  process.exit(1);
});
