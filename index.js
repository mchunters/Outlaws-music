require("dotenv").config();

const express = require("express");

const {
  Client,
  GatewayIntentBits,
  GatewayDispatchEvents
} = require("discord.js");

const { Riffy } = require("riffy");

const app = express();

const PORT = Number(process.env.PORT || 10000);

// =========================
// WEB SERVER FOR RENDER
// =========================

app.get("/", (req, res) => {
  res.status(200).send("🎵 Outlaws Music Bot is Online!");
});

app.get("/health", (req, res) => {
  const nodes = client.riffy?.nodes
    ? Array.from(client.riffy.nodes.values()).map(node => ({
        name: node.name,
        connected: node.connected
      }))
    : [];

  res.status(200).json({
    status: "online",
    bot: client.user?.tag || "starting",
    lavalink: nodes
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// =========================
// DISCORD CLIENT
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =========================
// LAVALINK
// =========================

const nodes = [
  {
    name: "Main",

    host: process.env.LAVALINK_HOST,

    port: Number(
      process.env.LAVALINK_PORT || 2333
    ),

    password: process.env.LAVALINK_PASSWORD,

    secure:
      String(process.env.LAVALINK_SECURE)
        .toLowerCase() === "true"
  }
];

client.riffy = new Riffy(client, nodes, {
  send: payload => {
    const guild = client.guilds.cache.get(
      payload.d.guild_id
    );

    if (guild) {
      guild.shard.send(payload);
    }
  },

  defaultSearchPlatform: "ytmsearch",

  restVersion: "v4"
});

// =========================
// COMMANDS
// =========================

const commands = require("./commands");

// =========================
// READY
// =========================

client.once("ready", () => {
  console.log(
    `✅ Logged in as ${client.user.tag}`
  );

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

// =========================
// VOICE STATE
// =========================

client.on("raw", data => {
  if (
    data.t !== GatewayDispatchEvents.VoiceStateUpdate &&
    data.t !== GatewayDispatchEvents.VoiceServerUpdate
  ) {
    return;
  }

  client.riffy.updateVoiceState(data);
});

// =========================
// SLASH COMMANDS
// =========================

client.on(
  "interactionCreate",
  async interaction => {

    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command =
      commands[interaction.commandName];

    if (!command) {
      return;
    }

    try {

      await command.execute(
        interaction,
        client
      );

    } catch (error) {

      console.error(
        `❌ ${interaction.commandName}:`,
        error
      );

      const message =
        "❌ Something went wrong. Check Render logs.";

      if (
        interaction.replied ||
        interaction.deferred
      ) {

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
  }
);

// =========================
// LAVALINK CONNECT
// =========================

client.riffy.on(
  "nodeConnect",
  node => {

    console.log(
      `🟢 Lavalink Connected: ${node.name}`
    );

  }
);

// =========================
// LAVALINK ERROR
// =========================

client.riffy.on(
  "nodeError",
  (node, error) => {

    console.error(
      `🔴 Lavalink Error (${node.name}):`,
      error.message
    );

  }
);

// =========================
// TRACK START
// =========================

client.riffy.on(
  "trackStart",
  (player, track) => {

    console.log(
      `🎵 Playing: ${track.info.title}`
    );

    const channel =
      client.channels.cache.get(
        player.textChannel
      );

    if (channel) {

      channel.send(
        `🎶 Now Playing: **${track.info.title}**`
      ).catch(() => {});

    }
  }
);

// =========================
// QUEUE END
// =========================

client.riffy.on(
  "queueEnd",
  player => {

    console.log("📭 Queue finished.");

    const channel =
      client.channels.cache.get(
        player.textChannel
      );

    if (channel) {

      channel.send(
        "✅ Queue finished."
      ).catch(() => {});

    }

    try {
      player.destroy();
    } catch {}
  }
);

// =========================
// ERRORS
// =========================

process.on(
  "unhandledRejection",
  error => {

    console.error(
      "Unhandled Rejection:",
      error
    );

  }
);

process.on(
  "uncaughtException",
  error => {

    console.error(
      "Uncaught Exception:",
      error
    );

  }
);

// =========================
// LOGIN
// =========================

client.login(
  process.env.DISCORD_TOKEN
);
