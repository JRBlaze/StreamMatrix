import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractYouTubeVideoId,
  normalizeYouTubeChannelInput,
  resolveYouTubeLiveVideo
} from "./src/providers.js";

const rootDirectory = fileURLToPath(new URL("./public/", import.meta.url));
const defaultPort = Number.parseInt(process.env.PORT ?? "4173", 10);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"]
]);

function applySecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-src https://player.twitch.tv https://www.twitch.tv https://player.kick.com https://kick.com https://www.youtube.com https://www.youtube-nocookie.com",
      "base-uri 'none'",
      "form-action 'self'"
    ].join("; ")
  );
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function handleYouTubeResolve(requestUrl, response) {
  const input = requestUrl.searchParams.get("input")?.trim();
  if (!input) {
    sendJson(response, 400, { error: "Enter a YouTube handle, channel URL, or live video URL." });
    return;
  }

  const directVideoId = extractYouTubeVideoId(input);
  if (directVideoId) {
    sendJson(response, 200, { videoId: directVideoId });
    return;
  }

  const channelUrl = normalizeYouTubeChannelInput(input);
  if (!channelUrl) {
    sendJson(response, 400, {
      error: "Use a YouTube @handle, channel URL, or video URL."
    });
    return;
  }

  try {
    const videoId = await resolveYouTubeLiveVideo(channelUrl);
    if (!videoId) {
      sendJson(response, 404, {
        error: "No active public live stream was found for that YouTube channel."
      });
      return;
    }
    sendJson(response, 200, { videoId });
  } catch (error) {
    console.error("YouTube resolution failed:", error);
    sendJson(response, 502, {
      error: "YouTube could not be reached. Try a live video URL instead."
    });
  }
}

async function serveStatic(requestUrl, response) {
  const requestedPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const decodedPath = decodeURIComponent(requestedPath);
  const filePath = normalize(join(rootDirectory, decodedPath));

  if (!filePath.startsWith(rootDirectory)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      throw new Error("Not a file");
    }

    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes.get(extname(filePath)) ?? "application/octet-stream",
      "Cache-Control": extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600"
    });
    response.end(content);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

export const server = createServer(async (request, response) => {
  applySecurityHeaders(response);

  if (!request.url || request.method !== "GET") {
    response.writeHead(405, { Allow: "GET" });
    response.end("Method not allowed");
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
  if (requestUrl.pathname === "/api/youtube/resolve") {
    await handleYouTubeResolve(requestUrl, response);
    return;
  }

  await serveStatic(requestUrl, response);
});

export function startServer(port = defaultPort, host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve(server.address());
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

export function stopServer() {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer().then((address) => {
    console.log(`StreamMatrix is running at http://localhost:${address.port}`);
  });
}
