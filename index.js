

require("dotenv").config();
const { Client, GatewayIntentBits, Partials, REST, Routes } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

require("./cmds")(client);
require("./announce")(client);
require("./verifyReact")(client);

client.once("clientReady", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  const commands = [
    {
      name: "matchstart",
      description: "Start a match",
      options: [
        { name: "team1", type: 3, description: "Team 1", required: true },
        { name: "team2", type: 3, description: "Team 2", required: true }
      ]
    },
    { name: "endmatch", description: "End current match" },
    {
      name: "addprivateserver",
      description: "Set private server",
      options: [
        { name: "link", type: 3, description: "Server link", required: true }
      ]
    },
    { name: "timetable", description: "Post match time voting" }
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );

  console.log("✅ Slash commands registered");
});

client.login(process.env.TOKEN);
