const { execSync } = require("child_process");

const email = process.env.ADMIN_EMAIL || "admin@sai-ajanta.com";
const password = process.env.ADMIN_PASSWORD;

if (!password || password.length < 8) {
  console.error(
    "ERROR: ADMIN_PASSWORD environment variable is required and must be at least 8 characters long."
  );
  console.error("Usage: ADMIN_PASSWORD=YourSecurePassword node ./src/scripts/create-admin.js");
  process.exit(1);
}

try {
  console.log(`Creating/updating admin user: ${email}...`);
  execSync(`npx medusa user -e "${email}" -p "${password}"`, {
    stdio: "inherit",
  });
  console.log("Admin user provisioned successfully.");
} catch (err) {
  console.error("Failed to provision admin user.", err.message);
  process.exit(1);
}
