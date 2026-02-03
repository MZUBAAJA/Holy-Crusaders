const fs = require("fs");
const path = require("path");

const MATCH_FILE = path.join(__dirname, "data", "matches.json");

const RESULT_CHANNEL = "1468305018410111113";
const ANNOUNCE_CHANNEL = "1468305090715717906";

const STAFF_ROLES = [
  "1462908737609007378",
  "1464372699613892741"
];

/* ================= HELPERS ================= */
const load = () => {
  try {
    const r = fs.readFileSync(MATCH_FILE, "utf8").trim();
    return r ? JSON.parse(r) : {};
  } catch {
    return {};
  }
};

const save = d =>
  fs.writeFileSync(MATCH_FILE, JSON.stringify(d, null, 2));

const mention = ids => ids.map(id => `<@${id}>`).join(" ");

const isStaff = m =>
  m.roles.cache.some(r => STAFF_ROLES.includes(r.id));

const requiredReacts = playerCount => {
  if (playerCount <= 2) return 1;
  if (playerCount <= 4) return 3;
  if (playerCount <= 6) return 4;
  if (playerCount <= 8) return 5;
  return 6;
};

/* ================= MODULE ================= */
module.exports = client => {

  /* =====================================================
     PLAYER !END COMMAND
     ===================================================== */
  client.on("messageCreate", async msg => {
    if (msg.author.bot) return;
    if (msg.content !== "!end") return;

    const data = load();
    const match = data.current;
    if (!match) return;
    if (msg.channel.id !== match.channelId) return;

    // already ending or ended
    if (match.endVote || match.awaitingProof) return;

    const need = requiredReacts(match.players.length);

    const endMsg = await msg.channel.send(
      `🛑 **Confirm Round End**\n\n` +
      `React below to end the round.\n` +
      `Required reactions: **${need}**`
    );

    await endMsg.react("✅");

    match.endVote = {
      messageId: endMsg.id,
      needed: need
    };

    save(data);
  });

  /* =====================================================
     END VOTE REACTION
     ===================================================== */
  client.on("messageReactionAdd", async (reaction, user) => {
    if (user.bot) return;
    if (reaction.emoji.name !== "✅") return;

    const data = load();
    const match = data.current;
    if (!match || !match.endVote) return;
    if (reaction.message.id !== match.endVote.messageId) return;

    const msg = await reaction.message.fetch();
    const count = msg.reactions.cache.get("✅")?.count || 0;

    // minus bot reaction
    if (count - 1 < match.endVote.needed) return;

    // end round
    delete match.endVote;
    match.active = false;
    match.awaitingProof = true;

    save(data);
    client.emit("roundEnded");
  });

  /* =====================================================
     PROOF SUBMISSION
     ===================================================== */
  client.on("messageCreate", async msg => {
    if (msg.author.bot) return;
    if (!msg.attachments.size) return;

    const data = load();
    const match = data.current;
    if (!match || !match.awaitingProof) return;
    if (msg.channel.id !== match.channelId) return;

    const resultCh = await client.channels.fetch(RESULT_CHANNEL);

    const verifyMsg = await resultCh.send({
      content:
        `📸 **Match Proof Submitted**\n\n` +
        `🆚 **Team 1:** ${mention(match.team1)}\n` +
        `🆚 **Team 2:** ${mention(match.team2)}\n\n` +
        `🗳️ **Staff Voting (2 votes required)**\n` +
        `1️⃣ = Team 1 wins\n` +
        `2️⃣ = Team 2 wins`,
      files: [...msg.attachments.values()]
    });

    await verifyMsg.react("1️⃣");
    await verifyMsg.react("2️⃣");

    match.verify = {
      messageId: verifyMsg.id,
      votes: { t1: [], t2: [] }
    };

    match.awaitingProof = false;
    save(data);
  });

  /* =====================================================
     STAFF VOTING → FINAL ANNOUNCE
     ===================================================== */
  client.on("messageReactionAdd", async (reaction, user) => {
    if (user.bot) return;
    if (!["1️⃣", "2️⃣"].includes(reaction.emoji.name)) return;
    if (reaction.message.channel.id !== RESULT_CHANNEL) return;

    const data = load();
    const match = data.current;
    if (!match || !match.verify) return;
    if (reaction.message.id !== match.verify.messageId) return;

    const member = await reaction.message.guild.members
      .fetch(user.id)
      .catch(() => null);
    if (!member || !isStaff(member)) return;

    match.verify.votes.t1 =
      match.verify.votes.t1.filter(id => id !== user.id);
    match.verify.votes.t2 =
      match.verify.votes.t2.filter(id => id !== user.id);

    if (reaction.emoji.name === "1️⃣")
      match.verify.votes.t1.push(user.id);
    else
      match.verify.votes.t2.push(user.id);

    const t1 = match.verify.votes.t1.length;
    const t2 = match.verify.votes.t2.length;

    if (t1 + t2 < 2) {
      save(data);
      return;
    }

    const winners = t1 > t2 ? match.team1 : match.team2;
    const losers  = t1 > t2 ? match.team2 : match.team1;

    const announce = await client.channels.fetch(ANNOUNCE_CHANNEL);

    await announce.send(
      `🏆 **MATCH RESULT**\n\n` +
      `✅ **Winners:** ${mention(winners)}\n` +
      `❌ **Losers:** ${mention(losers)}`
    );

    delete data.current;
    save(data);
  });
};
