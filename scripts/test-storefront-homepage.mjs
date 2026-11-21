import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;
const BASE_URL = "http://localhost:3000";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      this.callbacks.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function getDebuggerUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      if (list && list.length > 0 && list[0].webSocketDebuggerUrl) {
        return list[0].webSocketDebuggerUrl;
      }
    } catch {
      await sleep(500);
    }
  }
  throw new Error("Could not connect to Chrome debugging port");
}

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failCount++;
  }
}

async function runTests() {
  console.log("=== RUNNING STOREFRONT HOMEPAGE AUTOMATED INTERACTION TESTS ===");
  const chromeProc = spawn(CHROME_PATH, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ]);

  try {
    const wsUrl = await getDebuggerUrl();
    const client = new CDPClient(wsUrl);
    await client.connect();

    await client.send("Page.enable");
    await client.send("Runtime.enable");

    // Track console errors
    const consoleErrors = [];
    client.ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
          consoleErrors.push(msg.params.args.map((a) => a.value || a.description).join(" "));
        }
      } catch {}
    });

    const evaluate = async (expression) => {
      const res = await client.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res.result ? res.result.value : null;
    };

    // Set desktop viewport
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    console.log("\nNavigating to homepage:", BASE_URL);
    await client.send("Page.navigate", { url: BASE_URL });
    await sleep(2500);

    // TEST GROUP 1: Desktop Navigation and Brand Branding
    console.log("\n--- TEST GROUP 1: Navigation & Brand Consistency ---");
    const navText = await evaluate(`
      (() => {
        const header = document.querySelector('header');
        return header ? header.innerText : '';
      })()
    `);
    assert(navText.includes("Shop by Category"), "Header contains 'Shop by Category'");
    assert(navText.includes("House of Ajantha"), "Header uses approved 'House of Ajantha' brand naming");
    assert(!navText.includes("House of Ajanta"), "Header does not contain unapproved 'House of Ajanta'");
    assert(navText.includes("Contact"), "Header contains 'Contact'");

    // TEST GROUP 2: Nine Direct-Sale Category Cards
    console.log("\n--- TEST GROUP 2: Nine Direct-Sale Categories ---");
    const categoriesData = await evaluate(`
      (() => {
        const section = document.getElementById('shop-by-category');
        if (!section) return [];
        const links = Array.from(section.querySelectorAll('a[href^="/products?category="]'));
        return links.map(a => ({
          href: a.getAttribute('href'),
          text: a.querySelector('h3') ? a.querySelector('h3').innerText : a.innerText
        }));
      })()
    `);
    assert(categoriesData.length === 9, `Found exactly 9 direct-sale category cards (got ${categoriesData.length})`);
    const expectedCategories = [
      "Finished Insect Screens",
      "Aluminium Sections",
      "Hardware",
      "Ladders",
      "Rubber & PVC Beading",
      "FGM Fittings & Channels",
      "Clips",
      "Frames & Channels",
      "Mesh",
    ];
    for (const exp of expectedCategories) {
      const found = categoriesData.some((c) => c.text.includes(exp));
      assert(found, `Category card for '${exp}' is rendered`);
    }

    // TEST GROUP 3: House of Ajantha Section and Commercial Guardrails
    console.log("\n--- TEST GROUP 3: House of Ajantha Section & Commercial Safeguards ---");
    const hoaSection = await evaluate(`
      (() => {
        const section = document.getElementById('house-of-ajantha') || document.getElementById('house-of-ajanta');
        if (!section) return null;
        return {
          text: section.innerText,
          doorCloserLink: section.querySelector('a[href*="Door+Closer"]')?.getAttribute('href'),
          kitchenBasketLink: section.querySelector('a[href*="Kitchen+Basket"]')?.getAttribute('href'),
          distributorLink: section.querySelector('a[href*="DISTRIBUTOR"]')?.getAttribute('href'),
          hasBuyNowButton: Array.from(section.querySelectorAll('button, a')).some(el => el.innerText.toLowerCase().includes('buy now'))
        };
      })()
    `);
    assert(hoaSection !== null, "House of Ajantha section exists in DOM");
    assert(hoaSection && !hoaSection.hasBuyNowButton, "Zero 'Buy Now' buttons in House of Ajantha (preserves distributor route)");
    assert(
      hoaSection && hoaSection.text.includes("Floor springs: availability and sales route subject to confirmation"),
      "Strict Floor Springs commercial disclaimer is present"
    );
    assert(
      hoaSection && hoaSection.text.includes("Tested to 100,000 continuous operating cycles"),
      "Door closer lifecycle rating correctly states verified 100,000 cycles (not inflated 500,000)"
    );
    assert(
      hoaSection && hoaSection.distributorLink === "/register?role=DISTRIBUTOR",
      "Distributor CTA routes to /register?role=DISTRIBUTOR"
    );

    // TEST GROUP 4: Contact Form Validation & Submission
    console.log("\n--- TEST GROUP 4: Contact Enquiry Form Validation & Submission ---");
    // Scroll to contact section
    await evaluate(`document.getElementById('contact-information').scrollIntoView();`);
    await sleep(500);

    // Test 4A: Submit empty form triggers validation
    await evaluate(`
      (() => {
        const form = document.querySelector('#contact-information form');
        if (form) form.querySelector('button[type="submit"]').click();
      })()
    `);
    await sleep(400);
    const formErrorsEmpty = await evaluate(`
      (() => {
        const form = document.querySelector('#contact-information form');
        return form ? form.innerText : '';
      })()
    `);
    assert(formErrorsEmpty.includes("Full name is required"), "Empty submit triggers 'Full name is required' error");
    assert(formErrorsEmpty.includes("Mobile number is required"), "Empty submit triggers 'Mobile number is required' error");

    // Test 4B: Invalid mobile number
    await evaluate(`
      (() => {
        function setReactVal(input, val) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const nameInput = document.getElementById('enquiry-name');
        const phoneInput = document.getElementById('enquiry-phone');
        if (nameInput) setReactVal(nameInput, 'Ramesh Kumar');
        if (phoneInput) setReactVal(phoneInput, '12345');

        const form = document.querySelector('#contact-information form');
        if (form) form.querySelector('button[type="submit"]').click();
      })()
    `);
    await sleep(400);
    const formErrorsInvalidPhone = await evaluate(`
      (() => {
        const form = document.querySelector('#contact-information form');
        return form ? form.innerText : '';
      })()
    `);
    assert(
      formErrorsInvalidPhone.includes("Enter a valid 10-digit mobile number"),
      "Invalid mobile '12345' triggers format validation error"
    );

    // TEST GROUP 5: Dealer & Distributor Application Navigation & Trade Review Safeguards
    console.log("\n--- TEST GROUP 5: Dealer & Distributor Application Navigation & Trade Safeguards ---");
    // Verify Dealer CTA links to /register?type=dealer
    const dealerLink = await evaluate(`
      (() => {
        const links = Array.from(document.querySelectorAll('a'));
        const l = links.find(a => a.textContent && a.textContent.includes('Apply to Become a Dealer'));
        return l ? l.getAttribute('href') : '';
      })()
    `);
    assert(dealerLink.includes('/register?type=dealer'), "Dealer CTA links to /register?type=dealer");

    // Verify Distributor CTA links to /register?type=distributor
    const distLink = await evaluate(`
      (() => {
        const links = Array.from(document.querySelectorAll('a'));
        const l = links.find(a => a.textContent && a.textContent.includes('Apply to Become a Distributor'));
        return l ? l.getAttribute('href') : '';
      })()
    `);
    assert(distLink.includes('/register?type=distributor'), "Distributor CTA links to /register?type=distributor");

    // Navigate to /register?type=dealer and assert trade review notice is displayed
    await client.send("Page.navigate", { url: `${BASE_URL}/register?type=dealer` });
    await sleep(1500);
    const registerPageText = await evaluate(`document.body.innerText`);
    assert(
      registerPageText.includes("Trade accounts require administrator approval") ||
      registerPageText.includes("Admin Review"),
      "Dealer registration states trade accounts require administrator approval"
    );

    // Return to homepage
    await client.send("Page.navigate", { url: BASE_URL });
    await sleep(2000);

    // TEST GROUP 6: Useful Articles Dialog Reader
    console.log("\n--- TEST GROUP 6: Useful Articles Interactive Reader ---");
    await evaluate(`
      (() => {
        const articleSec = document.getElementById('useful-articles');
        if (articleSec) {
          const readBtn = articleSec.querySelector('button');
          if (readBtn) readBtn.click();
        }
      })()
    `);
    await sleep(600);
    const articleModalContent = await evaluate(`
      (() => {
        const dialog = document.querySelector('[role="dialog"]');
        return dialog ? dialog.innerText : '';
      })()
    `);
    assert(
      articleModalContent.includes("BS EN 1154 Door Closer Sizing Guide") ||
        articleModalContent.includes("Door Closer Selection Guide"),
      "Clicking 'Read Article' opens article reading dialog modal"
    );
    assert(
      articleModalContent.toUpperCase().includes("VIEW RELATED SPECIFICATIONS"),
      "Article dialog contains link to related product category specifications"
    );

    // Close Article Modal
    await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape" });
    await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape" });
    await sleep(500);

    // TEST GROUP 7: Footer and Contact Channels
    console.log("\n--- TEST GROUP 7: Footer & Brand Links ---");
    const footerData = await evaluate(`
      (() => {
        const footer = document.querySelector('footer');
        if (!footer) return null;
        return {
          text: footer.innerText,
          phoneHref: footer.querySelector('a[href^="tel:"]')?.getAttribute('href'),
          waHref: footer.querySelector('a[href*="wa.me"]')?.getAttribute('href'),
          returnPolicy: footer.querySelector('a[href="/return-policy"]')?.getAttribute('href'),
          hasBackToTop: Boolean(footer.querySelector('button'))
        };
      })()
    `);
    assert(footerData && footerData.phoneHref === "tel:+919842406588", "Footer telephone link matches +91 98424 06588");
    assert(footerData && footerData.waHref && footerData.waHref.includes("919842406588"), "Footer WhatsApp link is valid");
    assert(footerData && footerData.returnPolicy === "/return-policy", "Footer contains working Return Policy route");
    assert(footerData && footerData.hasBackToTop, "Footer Back to Top button is rendered");

    // Check console errors
    console.log("\n--- TEST GROUP 8: Browser Console Cleanliness ---");
    const fatalErrors = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("hydration") && !e.includes("404")
    );
    assert(fatalErrors.length === 0, `Zero fatal runtime errors in browser console (found ${fatalErrors.length})`);

    client.close();
  } finally {
    chromeProc.kill();
  }

  console.log("\n========================================================");
  console.log(`TEST RUN SUMMARY: ${passCount} Passed, ${failCount} Failed.`);
  console.log("========================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution aborted:", err);
  process.exit(1);
});
