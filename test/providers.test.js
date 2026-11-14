import test from "node:test";
import assert from "node:assert/strict";
import {
  extractYouTubeVideoId,
  normalizeYouTubeChannelInput,
  resolveYouTubeLiveVideo
} from "../src/providers.js";

test("extractYouTubeVideoId handles common YouTube video URLs", () => {
  assert.equal(
    extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "dQw4w9WgXcQ"
  );
  assert.equal(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=2"), "dQw4w9WgXcQ");
  assert.equal(extractYouTubeVideoId("https://youtube.com/live/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(extractYouTubeVideoId("somechannel"), null);
});

test("normalizeYouTubeChannelInput accepts handles and channel URLs", () => {
  assert.equal(
    normalizeYouTubeChannelInput("@GoogleDevelopers"),
    "https://www.youtube.com/@GoogleDevelopers/live"
  );
  assert.equal(
    normalizeYouTubeChannelInput("youtube.com/@GoogleDevelopers/videos"),
    "https://www.youtube.com/@GoogleDevelopers/live"
  );
  assert.equal(
    normalizeYouTubeChannelInput("https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw"),
    "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw/live"
  );
  assert.equal(normalizeYouTubeChannelInput("https://example.com/channel"), null);
});

test("resolveYouTubeLiveVideo uses a redirected watch URL", async () => {
  const fakeFetch = async () => ({
    ok: true,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    text: async () => ""
  });
  assert.equal(
    await resolveYouTubeLiveVideo("https://www.youtube.com/@channel/live", fakeFetch),
    "dQw4w9WgXcQ"
  );
});

test("resolveYouTubeLiveVideo only selects HTML video IDs marked live", async () => {
  const fakeFetch = async () => ({
    ok: true,
    url: "https://www.youtube.com/@channel/live",
    text: async () =>
      '{"videoId":"AAAAAAAAAAA","title":"offline recommendation"}' +
      '{"videoId":"dQw4w9WgXcQ","viewCountText":"1 watching","isLiveNow":true}'
  });
  assert.equal(
    await resolveYouTubeLiveVideo("https://www.youtube.com/@channel/live", fakeFetch),
    "dQw4w9WgXcQ"
  );
});

test("resolveYouTubeLiveVideo returns null for an offline channel page", async () => {
  const fakeFetch = async () => ({
    ok: true,
    url: "https://www.youtube.com/@channel/live",
    text: async () => '{"videoId":"AAAAAAAAAAA","title":"uploaded video"}'
  });
  assert.equal(
    await resolveYouTubeLiveVideo("https://www.youtube.com/@channel/live", fakeFetch),
    null
  );
});

test("YouTube parsers reject malformed URLs, missing IDs, and non-channel paths", () => {
  for (const input of ["http://[", ""]) {
    assert.equal(extractYouTubeVideoId(input), null);
    assert.equal(normalizeYouTubeChannelInput(input), null);
  }
  assert.equal(extractYouTubeVideoId("https://youtu.be"), null);
  assert.equal(extractYouTubeVideoId("https://youtu.be/too-short"), null);
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/watch?v=too-short"), null);
  assert.equal(normalizeYouTubeChannelInput("https://www.youtube.com/watch?v=too-short"), null);
  assert.equal(normalizeYouTubeChannelInput("GoogleDevelopers"), "https://www.youtube.com/@GoogleDevelopers/live");
});

test("YouTube resolution reports upstream HTTP errors", async () => {
  await assert.rejects(
    resolveYouTubeLiveVideo("https://www.youtube.com/@channel/live", async () => ({ ok: false, status: 503 })),
    /YouTube returned 503/
  );
});
