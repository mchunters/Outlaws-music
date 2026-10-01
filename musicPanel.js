const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const PANEL_CHANNEL_ID = "1547515109667241984";
const PANEL_REFRESH_MS = 10000;

const panels = new Map();

function formatTime(ms = 0) {
  const seconds = Math.max(0, Math.floor(Number(ms) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function createProgressBar(current, total, length = 15) {
  if (!total || total <= 0) {
    return "▱".repeat(length);
  }

  const ratio = Math.min(1, Math.max(0, Number(current || 0) / Number(total)));
  const filled = Math.round(ratio * length);

  return "▰".repeat(filled) + "▱".repeat(length - filled);
}

function getLoop(player) {
  return player?.loop || "none";
}

function getRequester(track) {
  return track?.info?.requester || null;
}

function getDuration(track) {
  return Number(
    track?.info?.duration ||
    track?.info?.length ||
    0
  );
}

function createEmbed(client, player, track) {
  const current = Number(player?.position || 0);
  const duration = getDuration(track);
  const requester = getRequester(track);
  const loop = getLoop(player);

  const embed = new EmbedBuilder()
    .setColor("#F0F0A0")
    .setAuthor({
      name: "Now Playing 🎵",
      iconURL: client.user.displayAvatarURL()
    })
    .setTitle(track?.info?.title || "Unknown Song")
    .setDescription(
      `${createProgressBar(current, duration)}\n\`${formatTime(current)} / ${formatTime(duration)}\``
    )
    .addFields(
      {
        name: "👤 Artist",
        value: `\`${track?.info?.author || "Unknown"}\``,
        inline: true
      },
      {
        name: "⌛ Duration",
        value: `\`${formatTime(duration)}\``,
        inline: true
      },
      {
        name: "🎧 Requested by",
        value: requester ? `${requester}` : "Unknown",
        inline: true
      }
    )
    .setFooter({
      text: `Volume: ${Number(player?.volume ?? 100)}% | Loop: ${
        loop === "none" ? "off" : loop
      }`
    });

  if (track?.info?.uri) {
    embed.setURL(track.info.uri);
  }

  if (track?.info?.artworkUrl) {
    embed.setThumbnail(track.info.artworkUrl);
  }

  return embed;
}

function createIdleEmbed(client) {
  return new EmbedBuilder()
    .setColor("#F0F0A0")
    .setAuthor({
      name: "Outlaws Music 🎵",
      iconURL: client.user.displayAvatarURL()
    })
    .setTitle("Nothing is playing")
    .setDescription("Use `/play` to start music.")
    .setFooter({
      text: "Music control panel"
    });
}

function createButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("music_previous")
      .setLabel("⏮️")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("music_seek_back")
      .setLabel("⏪ 10s")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("music_play_pause")
      .setLabel("⏯️")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("music_seek_forward")
      .setLabel("10s ⏩")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("music_skip")
      .setLabel("⏭️")
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("music_volume_down")
      .setLabel("-10 🔉")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("music_loop")
      .setLabel("🔄")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("music_stop")
      .setLabel("⏹️")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("music_shuffle")
      .setLabel("🔀")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("music_volume_up")
      .setLabel("🔊 +10")
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

function isPanelMessage(message) {
  if (!message?.components?.length) {
    return false;
  }

  return message.components.some(row =>
    row.components?.some(component =>
      component.customId === "music_play_pause"
    )
  );
}

async function findExistingPanelMessage(client, channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });

    const matches = messages.filter(
      message =>
        message.author?.id === client.user.id &&
        isPanelMessage(message)
    );

    const sorted = [...matches.values()].sort(
      (a, b) => b.createdTimestamp - a.createdTimestamp
    );

    const keep = sorted[0] || null;

    for (const oldMessage of sorted.slice(1)) {
      await oldMessage.delete().catch(() => {});
    }

    return keep;
  } catch (error) {
    console.error("❌ Could not scan music panel channel:", error);
    return null;
  }
}

function stopPanelTimer(guildId) {
  const state = panels.get(guildId);

  if (state?.interval) {
    clearInterval(state.interval);
  }

  if (state) {
    panels.delete(guildId);
  }
}

async function getPanelMessage(client, channel, guildId, embed) {
  const currentState = panels.get(guildId);

  if (currentState?.message) {
    try {
      await currentState.message.edit({
        embeds: [embed],
        components: createButtons()
      });

      return currentState.message;
    } catch {
      stopPanelTimer(guildId);
    }
  }

  let message = await findExistingPanelMessage(client, channel);

  if (message) {
    try {
      await message.edit({
        embeds: [embed],
        components: createButtons()
      });
      return message;
    } catch {
      message = null;
    }
  }

  return channel.send({
    embeds: [embed],
    components: createButtons()
  });
}

async function sendMusicPanel(client, player, track) {
  if (!player?.guildId || !track) {
    return;
  }

  const channel = await client.channels
    .fetch(PANEL_CHANNEL_ID)
    .catch(() => null);

  if (!channel || !channel.isTextBased()) {
    console.error(
      "❌ Music Panel channel not found:",
      PANEL_CHANNEL_ID
    );
    return;
  }

  const guildId = player.guildId;

  stopPanelTimer(guildId);

  const embed = createEmbed(client, player, track);
  const message = await getPanelMessage(
    client,
    channel,
    guildId,
    embed
  );

  const interval = setInterval(async () => {
    if (!player?.current) {
      stopPanelTimer(guildId);
      return;
    }

    try {
      await message.edit({
        embeds: [
          createEmbed(client, player, player.current)
        ],
        components: createButtons()
      });
    } catch (error) {
      stopPanelTimer(guildId);
      console.error("❌ Music panel update failed:", error.message);
    }
  }, PANEL_REFRESH_MS);

  panels.set(guildId, {
    message,
    interval
  });
}

async function clearMusicPanel(client, guildId) {
  const state = panels.get(guildId);

  if (state?.interval) {
    clearInterval(state.interval);
  }

  panels.delete(guildId);

  const channel = await client.channels
    .fetch(PANEL_CHANNEL_ID)
    .catch(() => null);

  if (!channel || !channel.isTextBased()) {
    return;
  }

  let message = state?.message || null;

  if (!message) {
    message = await findExistingPanelMessage(client, channel);
  }

  if (!message) {
    return;
  }

  await message.edit({
    embeds: [createIdleEmbed(client)],
    components: createButtons()
  }).catch(() => {});
}

async function handleMusicButton(interaction, client) {
  if (!interaction.isButton()) {
    return false;
  }

  if (!interaction.customId.startsWith("music_")) {
    return false;
  }

  if (interaction.channelId !== PANEL_CHANNEL_ID) {
    await interaction.reply({
      content: "❌ Music controls only work in the music panel channel.",
      ephemeral: true
    }).catch(() => {});
    return true;
  }

  const player = client.riffy.players.get(interaction.guildId);

  if (!player?.current) {
    await interaction.reply({
      content: "❌ Nothing is playing.",
      ephemeral: true
    }).catch(() => {});
    return true;
  }

  try {
    await interaction.deferUpdate();

    switch (interaction.customId) {
      case "music_previous": {
        const previous = player.previous;

        if (!previous) {
          await interaction.followUp({
            content: "❌ No previous song found.",
            ephemeral: true
          }).catch(() => {});
          return true;
        }

        const current = player.current;

        player.queue.unshift(current);
        player.queue.unshift(previous);

        await player.stop();
        break;
      }

      case "music_seek_back": {
        const position = Math.max(
          0,
          Number(player.position || 0) - 10000
        );

        await player.seek(position);
        break;
      }

      case "music_play_pause": {
        await player.pause(!player.paused);
        break;
      }

      case "music_seek_forward": {
        const duration = getDuration(player.current);
        const position = Math.min(
          duration,
          Number(player.position || 0) + 10000
        );

        await player.seek(position);
        break;
      }

      case "music_skip": {
        await player.stop();
        break;
      }

      case "music_volume_down": {
        const volume = Math.max(
          0,
          Number(player.volume || 100) - 10
        );

        await player.setVolume(volume);
        break;
      }

      case "music_volume_up": {
        const volume = Math.min(
          100,
          Number(player.volume || 100) + 10
        );

        await player.setVolume(volume);
        break;
      }

      case "music_loop": {
        const modes = ["none", "track", "queue"];
        const current = getLoop(player);
        const index = modes.indexOf(current);
        const next = modes[(index + 1) % modes.length];

        await player.setLoop(next);
        break;
      }

      case "music_stop": {
        player.queue.clear();
        await player.stop();

        await clearMusicPanel(client, interaction.guildId);

        try {
          player.destroy();
        } catch {}

        break;
      }

      case "music_shuffle": {
        if (player.queue.length < 2) {
          await interaction.followUp({
            content: "❌ Queue-তে shuffle করার মতো যথেষ্ট song নেই.",
            ephemeral: true
          }).catch(() => {});
          return true;
        }

        player.queue.shuffle();
        break;
      }

      default:
        return true;
    }

    const state = panels.get(interaction.guildId);

    if (state?.message && player.current) {
      await state.message.edit({
        embeds: [
          createEmbed(client, player, player.current)
        ],
        components: createButtons()
      }).catch(() => {});
    }
  } catch (error) {
    console.error("❌ Music panel control error:", error);

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        content: "❌ Control ব্যবহার করতে সমস্যা হয়েছে.",
        ephemeral: true
      }).catch(() => {});
    } else {
      await interaction.reply({
        content: "❌ Control ব্যবহার করতে সমস্যা হয়েছে.",
        ephemeral: true
      }).catch(() => {});
    }
  }

  return true;
}

module.exports = {
  sendMusicPanel,
  handleMusicButton,
  clearMusicPanel
};
