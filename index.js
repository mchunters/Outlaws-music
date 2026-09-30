require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  Collection
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const app = express();

app.get("/", (req, res) => {
  res.send("🎵 Outlaws Music Bot is Online!");
});

app.listen(process.env.PORT || 10000, () => {
  console.log("🌐 Web server started");
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith(".js"));

  for (const file of commandFiles) {
    const command = require(`./commands/${file}`);

    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
    }
  }
}

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

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

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "❌ Something went wrong.",
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: "❌ Something went wrong.",
        ephemeral: true
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
