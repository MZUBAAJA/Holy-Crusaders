const fs = require("fs");
const path = require("path");
const { PermissionsBitField } = require("discord.js");
const SIX_HOURS = 6 * 60 * 60 * 1000;

const DATA = path.join(__dirname, "data");
const MATCH_FILE = path.join(DATA, "matches.json");
const CONFIG_FILE = path.join(DATA, "config.json");


if (!fs.existsSync(DATA)) fs.mkdirSync(DATA);
if (!fs.existsSync(MATCH_FILE)) fs.writeFileSync(MATCH_FILE, "{}");
if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, "{}");

const ROUND_CATEGORY = "1468308850309337138";
const TIME_VOTE_CHANNEL = "1468305166007795802";

const STAFF_ROLES = [
  "1462908737609007378",
  "1464372699613892741"
];

const load = f => JSON.parse(fs.readFileSync(f, "utf8") || "{}");
const save = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));
const ids = s => [...(s || "").matchAll(/<@!?(\d+)>/g)].map(x => x[1]);
const isStaff = m => m.roles.cache.some(r => STAFF_ROLES.includes(r.id));

module.exports = client => {
  client.on("interactionCreate", async i => {
    if (!i.isChatInputCommand()) return;
    if (!isStaff(i.member)) return i.reply({ content: "❌ Staff only", flags: 64 });

    const matches = load(MATCH_FILE);
    const config = load(CONFIG_FILE);
    
    
    /* PRIVATE SERVER */
    if (i.commandName === "addprivateserver") {
      config.privateServer = i.options.getString("link");
      save(CONFIG_FILE, config);
      return i.reply({ content: "✅ Private server saved", flags: 64 });
    }

    if (i.commandName === "timetable") {
      await i.deferReply({ flags: 64 });

      const ch = await i.guild.channels.fetch(TIME_VOTE_CHANNEL);

      await ch.send("🕒 **Match Time Voting**\nReact ✅ on the time you prefer.\n⏳ Voting ends in **6 hours**.");

      const now = new Date();
      now.setMinutes(0, 0, 0);

      const data = load(MATCH_FILE);
      data.timeVotes = [];

      for (let h = 0; h < 24; h++) {
        const t = Math.floor((now.getTime() + h * 3600000) / 1000);
        const msg = await ch.send(`⏰ <t:${t}:t>`);
        await msg.react("✅");

        data.timeVotes.push({
          time: t,
          messageId: msg.id
        });
      }

      data.timeVoteEndsAt = Date.now() + SIX_HOURS;
      save(MATCH_FILE, data);

      await i.editReply("✅ Time voting started (ends in 6 hours)");

      /* ===== AUTO END AFTER 6 HOURS ===== */
      setTimeout(async () => {
        const fresh = load(MATCH_FILE);
        if (!fresh.timeVotes || !fresh.timeVoteEndsAt) return;

        const results = [];
        for (const v of fresh.timeVotes) {
          const m = await ch.messages.fetch(v.messageId).catch(() => null);
          if (!m) continue;

          const count = m.reactions.cache.get("✅")?.count || 0;
          results.push({ time: v.time, count });
        }

        if (!results.length) return;

        results.sort((a, b) => b.count - a.count);
        const winner = results[0];

        await ch.send(
          `🏆 **Voting Closed**\nWinning Time: <t:${winner.time}:F>`
        );

        delete fresh.timeVotes;
        delete fresh.timeVoteEndsAt;
        save(MATCH_FILE, fresh);
      }, SIX_HOURS);
    }

    /* MATCH START */
    if (i.commandName === "matchstart") {
      const team1 = ids(i.options.getString("team1"));
      const team2 = ids(i.options.getString("team2"));
      if (!team1.length || !team2.length)
        return i.reply({ content: "❌ Teams missing", flags: 64 });

      const players = [...team1, ...team2];
      const ch = await i.guild.channels.create({
        name: "round-1",
        parent: ROUND_CATEGORY,
        permissionOverwrites: [
          { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          ...players.map(p => ({ id: p, allow: [PermissionsBitField.Flags.ViewChannel] }))
        ]
      });

      matches.current = {
        team1, team2, players,
        channelId: ch.id,
        active: true
      };

      save(MATCH_FILE, matches);
      client.emit("roundCreated");
      return i.reply({ content: "✅ Match started", flags: 64 });
    }

    /* END MATCH */
    if (i.commandName === "endmatch") {
      if (!matches.current)
        return i.reply({ content: "❌ No active match", flags: 64 });

      matches.current.active = false;
      save(MATCH_FILE, matches);
      client.emit("roundEnded");
      return i.reply({ content: "🛑 Match ended", flags: 64 });
    }
  });
};
