import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const allowedFiles = new Set([
  "index.html",
  "styles.css",
  "app.js",
  "firebase.js",
  "data-store.js"
]);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url || "/", "http://localhost").pathname;
    const requestedFile = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
    if (!allowedFiles.has(requestedFile)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Tidak ditemukan");
      return;
    }

    const content = await readFile(join(root, requestedFile));
    response.writeHead(200, {
      "Content-Type": contentTypes[requestedFile.slice(requestedFile.lastIndexOf("."))],
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cache-Control": "no-cache"
    });
    response.end(content);
  } catch {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Gagal membaca file aplikasi");
  }
});

server.listen(5173, "127.0.0.1", () => {
  console.log("BIVDA siap di http://localhost:5173 — biarkan jendela ini tetap terbuka.");
});
