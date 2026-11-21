import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

/**
 * Ensures platform-specific native binaries (.node) are copied into their respective parent package
 * directories if present. This eliminates issues where nested workspace node_modules fail to resolve
 * hoisted or sibling native binary packages (e.g. lightningcss, @swc/core, @tailwindcss/oxide) on Linux/Debian.
 */
function ensureNativeBinaries() {
  const platform = process.platform;
  const arch = process.arch;

  // 1. Resolve LightningCSS binary for Linux/Windows
  let lightningcssBinaryName = "";
  if (platform === "linux" && arch === "x64") {
    lightningcssBinaryName = "lightningcss.linux-x64-gnu.node";
  } else if (platform === "win32" && arch === "x64") {
    lightningcssBinaryName = "lightningcss.win32-x64-msvc.node";
  }

  if (lightningcssBinaryName) {
    const pkgName = lightningcssBinaryName.replace(/\.node$/, "");
    const candidateSources = [
      path.join(rootDir, "apps/storefront/node_modules", pkgName, lightningcssBinaryName),
      path.join(rootDir, "node_modules", pkgName, lightningcssBinaryName),
    ];

    const source = candidateSources.find((p) => fs.existsSync(p));
    if (source) {
      const targets = [
        path.join(rootDir, "apps/storefront/node_modules/lightningcss", lightningcssBinaryName),
        path.join(rootDir, "node_modules/lightningcss", lightningcssBinaryName),
      ];

      for (const target of targets) {
        const targetDir = path.dirname(target);
        if (fs.existsSync(targetDir) && !fs.existsSync(target)) {
          try {
            fs.copyFileSync(source, target);
            console.log(`[setup] Copied ${lightningcssBinaryName} -> ${path.relative(rootDir, target)}`);
          } catch (err) {
            console.warn(`[setup] Could not copy ${lightningcssBinaryName}:`, err.message);
          }
        }
      }
    }
  }

  // 2. Resolve @swc/core binary for Linux/Windows
  let swcBinaryName = "";
  if (platform === "linux" && arch === "x64") {
    swcBinaryName = "swc.linux-x64-gnu.node";
  } else if (platform === "win32" && arch === "x64") {
    swcBinaryName = "swc.win32-x64-msvc.node";
  }

  if (swcBinaryName) {
    const pkgName = `@swc/core-${platform}-${arch}-${platform === "win32" ? "msvc" : "gnu"}`;
    const candidateSources = [
      path.join(rootDir, "apps/backend/node_modules", pkgName, swcBinaryName),
      path.join(rootDir, "node_modules", pkgName, swcBinaryName),
    ];

    const source = candidateSources.find((p) => fs.existsSync(p));
    if (source) {
      const targets = [
        path.join(rootDir, "apps/backend/node_modules/@swc/core", swcBinaryName),
        path.join(rootDir, "node_modules/@swc/core", swcBinaryName),
      ];

      for (const target of targets) {
        const targetDir = path.dirname(target);
        if (fs.existsSync(targetDir) && !fs.existsSync(target)) {
          try {
            fs.copyFileSync(source, target);
            console.log(`[setup] Copied ${swcBinaryName} -> ${path.relative(rootDir, target)}`);
          } catch (err) {
            console.warn(`[setup] Could not copy ${swcBinaryName}:`, err.message);
          }
        }
      }
    }
  }

  // 3. Resolve @tailwindcss/oxide binary for Linux/Windows
  let oxideBinaryName = "";
  let oxidePkgName = "";
  if (platform === "linux" && arch === "x64") {
    oxideBinaryName = "tailwindcss-oxide.linux-x64-gnu.node";
    oxidePkgName = "@tailwindcss/oxide-linux-x64-gnu";
  } else if (platform === "win32" && arch === "x64") {
    oxideBinaryName = "tailwindcss-oxide.win32-x64-msvc.node";
    oxidePkgName = "@tailwindcss/oxide-win32-x64-msvc";
  }

  if (oxideBinaryName && oxidePkgName) {
    const candidateSources = [
      path.join(rootDir, "apps/storefront/node_modules", oxidePkgName, oxideBinaryName),
      path.join(rootDir, "node_modules", oxidePkgName, oxideBinaryName),
    ];

    const source = candidateSources.find((p) => fs.existsSync(p));
    if (source) {
      const targets = [
        path.join(rootDir, "apps/storefront/node_modules/@tailwindcss/oxide", oxideBinaryName),
        path.join(rootDir, "node_modules/@tailwindcss/oxide", oxideBinaryName),
      ];

      for (const target of targets) {
        const targetDir = path.dirname(target);
        if (fs.existsSync(targetDir) && !fs.existsSync(target)) {
          try {
            fs.copyFileSync(source, target);
            console.log(`[setup] Copied ${oxideBinaryName} -> ${path.relative(rootDir, target)}`);
          } catch (err) {
            console.warn(`[setup] Could not copy ${oxideBinaryName}:`, err.message);
          }
        }
      }
    }
  }
}

try {
  ensureNativeBinaries();
} catch (err) {
  // Gracefully degrade; do not block npm install on unexpected environments
  console.warn("[setup] Notice: ensureNativeBinaries encountered:", err.message);
}
