const fs = require("fs");
const path = require("path");

/* ================= FILE PATHS ================= */
const MATCH_FILE = path.join(__dirname, "data", "matches.json");
const CONFIG_FILE = path.join(__dirname, "data", "config.json");

/* ================= HELPERS ================= */
const load = file => {
  try {
    const raw = fs.readFileSync(file, "utf8").trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const mention = ids =>
  Array.isArray(ids) ? ids.map(id => `<@${id}>`).join(" ") : "None";

/* ================= MODULE ================= */
module.exports = client => {

  /* ==========================================================
     ROUND CREATED (matchstart)
     ========================================================== */
  client.on("roundCreated", async () => {
    const data = load(MATCH_FILE);
    const config = load(CONFIG_FILE);
    const match = data.current;
    if (!match) return;

    const channel = await client.channels
      .fetch(match.channelId)
      .catch(() => null);
    if (!channel) return;

    const msg =
      `🔔 **Round ${match.round || 1} Started**\n\n` +
      `👥 **Players:**\n${mention(match.players)}\n\n` +
      `🔗 **Private Server:**\n${config.privateServer || "❌ Not set"}\n\n` +
      `⚠️ **Record proof (screenshot / video)**\n\n` +
      `🛑 To end the round, type **\`!end\`**`;

    await channel.send(msg);
  });

  /* ==========================================================
     ROUND ENDED (via !end or /endmatch)
     ========================================================== */
  client.on("roundEnded", async () => {
    const data = load(MATCH_FILE);
    const match = data.current;
    if (!match) return;

    const channel = await client.channels
      .fetch(match.channelId)
      .catch(() => null);
    if (!channel) return;

    await channel.send(
      `🛑 **Round Ended**\n\n📸 Please send the match proof now.\n\n` +
      `After proof is sent, staff will verify the result.`
    );
  });

  /* ==========================================================
     RESULT VERIFIED (emitted from verifyReact.js)
     ========================================================== */
  client.on("resultVerified", async result => {
    /*
      result = {
        winners: [userIds],
        losers: [userIds]
      }
    */

    if (!result || !result.winners || !result.losers) return;

    const ANNOUNCE_CHANNEL = "1468305090715717906";

    const announce = await client.channels
      .fetch(ANNOUNCE_CHANNEL)
      .catch(() => null);
    if (!announce) return;

    await announce.send(
      `🏆 **MATCH RESULT**\n\n` +
      `✅ **Winners:** ${mention(result.winners)}\n` +
      `❌ **Losers:** ${mention(result.losers)}`
    );
  });
};
