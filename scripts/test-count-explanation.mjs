import http from "node:http";

async function run() {
  const wsUrlRes = await fetch("http://127.0.0.1:9222/json");
  const targets = await wsUrlRes.json();
  console.log("Chrome targets available:", targets.length);
}

run().catch(console.error);
