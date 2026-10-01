require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  GatewayDispatchEvents
} = require("discord.js");
const { Riffy } = require("riffy");

const {
  sendMusicPanel,
  handleMusicButton,
  clearMusicPanel
} = require("./musicPanel");

const app = express();
const PORT = Number(process.env.PORT || 10000);

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

  res.json({
    status: "online",
    bot: client.user?.tag || "starting",
    lavalink: nodes
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const nodes = [
  {
    name: "Main",
    host: process.env.LAVALINK_HOST,
    port: Number(process.env.LAVALINK_PORT || 2333),
    password: process.env.LAVALINK_PASSWORD,
    secure: String(process.env.LAVALINK_SECURE).toLowerCase() === "true"
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
  try {
    if (interaction.isButton()) {
      const handled = await handleMusicButton(interaction, client);

      if (handled) {
        return;
      }
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = commands[interaction.commandName];

    if (!command) {
      return;
    }

    await command.execute(interaction, client);
  } catch (error) {
    console.error("❌ Interaction Error:", error);

    const message = "❌ Something went wrong. Check Render logs.";

    try {
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
    } catch {}
  }
});

client.riffy.on("nodeConnect", node => {
  console.log(`🟢 Lavalink Connected: ${node.name}`);
});

client.riffy.on("nodeError", (node, error) => {
  console.error(`🔴 Lavalink Error (${node.name}):`, error.message);
});

client.riffy.on("trackStart", async (player, track) => {
  console.log(`🎵 Playing: ${track.info.title}`);

  try {
    await sendMusicPanel(client, player, track);
  } catch (error) {
    console.error("❌ Music Panel Error:", error);
  }
});

client.riffy.on("queueEnd", async player => {
  console.log("📭 Queue finished.");

  try {
    await clearMusicPanel(client, player.guildId);
  } catch (error) {
    console.error("❌ Panel clear error:", error);
  }

  try {
    player.destroy();
  } catch (error) {
    console.error("❌ Player destroy error:", error);
  }
});

process.on("unhandledRejection", error => {
  console.error("❌ Unhandled Rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("❌ Uncaught Exception:", error);
});

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing from environment variables.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
