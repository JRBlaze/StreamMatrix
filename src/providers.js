const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_PATH_PATTERN = /^\/(?:@[^/?#]+|channel\/[A-Za-z0-9_-]+|c\/[^/?#]+|user\/[^/?#]+)/;

export function extractYouTubeVideoId(input) {
  const value = input.trim();
  let url;
  try {
    url = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }

  if (url.hostname === "youtu.be") {
    const candidate = url.pathname.split("/").filter(Boolean)[0];
    return VIDEO_ID_PATTERN.test(candidate ?? "") ? candidate : null;
  }

  if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
    return null;
  }

  const queryVideoId = url.searchParams.get("v");
  if (VIDEO_ID_PATTERN.test(queryVideoId ?? "")) {
    return queryVideoId;
  }

  const pathMatch = url.pathname.match(/^\/(?:embed|live|shorts)\/([A-Za-z0-9_-]{11})/);
  return pathMatch?.[1] ?? null;
}

export function normalizeYouTubeChannelInput(input) {
  const value = input.trim();
  if (!value) {
    return null;
  }

  if (/^@?[A-Za-z0-9._-]+$/.test(value)) {
    const handle = value.startsWith("@") ? value : `@${value}`;
    return `https://www.youtube.com/${handle}/live`;
  }

  let url;
  try {
    url = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }

  if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
    return null;
  }

  const channelPath = url.pathname.match(CHANNEL_PATH_PATTERN)?.[0];
  return channelPath ? `https://www.youtube.com${channelPath}/live` : null;
}

function extractVideoIdFromHtml(html) {
  const patterns = [
    /<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/i,
    /"canonicalBaseUrl":"\/watch\?v=([A-Za-z0-9_-]{11})"/,
    /"videoId":"([A-Za-z0-9_-]{11})"(?:(?!"videoId")[\s\S]){0,1200}?"isLiveNow":true/,
    /"isLiveNow":true(?:(?!"videoId")[\s\S]){0,1200}?"videoId":"([A-Za-z0-9_-]{11})"/
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

export async function resolveYouTubeLiveVideo(channelUrl, fetchImplementation = fetch) {
  const response = await fetchImplementation(channelUrl, {
    redirect: "follow",
    headers: {
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": "Mozilla/5.0 StreamMatrix/1.0"
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`YouTube returned ${response.status}`);
  }

  const redirectedVideoId = extractYouTubeVideoId(response.url);
  if (redirectedVideoId) {
    return redirectedVideoId;
  }

  return extractVideoIdFromHtml(await response.text());
}
