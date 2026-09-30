require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  GatewayDispatchEvents
} = require("discord.js");
const { Riffy } = require("riffy");

const app = express();

const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("🎵 Outlaws Music Bot is Online!");
});

app.get("/health", (req, res) => {
  res.json({
    status: "online",
    bot: client.user?.tag || "starting",
    lavalink: client.riffy?.nodes?.map(node => ({
      name: node.name,
      connected: node.connected
    })) || []
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const nodes = [
  {
    name: "Main",
    host: process.env.LAVALINK_HOST,
    port: Number(process.env.LAVALINK_PORT),
    password: process.env.LAVALINK_PASSWORD,
    secure: process.env.LAVALINK_SECURE === "true"
  }
];

client.riffy = new Riffy(client, nodes, {
  send: payload => {
    const guild = client.guilds.cache.get(payload.d.guild_id);

    if (guild) {
      guild.shard.send(payload);
    }
  },

  defaultSearchPlatform: "ytmsearch",

  restVersion: "v4"
});

const commands = require("./commands");

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  client.riffy.init(client.user.id);

  client.user.setPresence({
    activities: [
      {
        name: "🎵 Outlaws Music",
        type: 2
      }
    ],
    status: "online"
  });
});

client.on("raw", data => {
  if (
    data.t !== GatewayDispatchEvents.VoiceStateUpdate &&
    data.t !== GatewayDispatchEvents.VoiceServerUpdate
  ) {
    return;
  }

  client.riffy.updateVoiceState(data);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands[interaction.commandName];

  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(error);

    const message =
      "❌ Command failed. Check Render logs.";

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: message,
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: message,
        ephemeral: true
      });
    }
  }
});

client.riffy.on("nodeConnect", node => {
  console.log(`🟢 Lavalink Connected: ${node.name}`);
});

client.riffy.on("nodeError", (node, error) => {
  console.error(
    `🔴 Lavalink Error (${node.name}):`,
    error.message
  );
});

client.riffy.on("trackStart", (player, track) => {
  console.log(`🎵 Playing: ${track.info.title}`);
});

client.riffy.on("queueEnd", player => {
  console.log("📭 Queue finished.");

  try {
    player.destroy();
  } catch {}
});

process.on("unhandledRejection", error => {
  console.error("Unhandled Rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("Uncaught Exception:", error);
});

client.login(process.env.DISCORD_TOKEN);
