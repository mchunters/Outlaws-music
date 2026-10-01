const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const PANEL_CHANNEL_ID = "1547515109667241984";

const panels = new Map();

function formatTime(ms = 0) {
  const seconds = Math.floor(ms / 1000);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${m}:${String(s).padStart(2, "0")}`;
}

function createProgressBar(current, total, length = 15) {
  if (!total || total <= 0) {
    return "▱".repeat(length);
  }

  const progress = Math.min(
    length,
    Math.max(
      0,
      Math.round((current / total) * length)
    )
  );

  return (
    "▰".repeat(progress) +
    "▱".repeat(length - progress)
  );
}

function getLoop(player) {
  return player.loop || "none";
}

function getRequester(track) {
  return track?.info?.requester || null;
}

function createEmbed(client, player, track) {
  const current =
    Number(player.position || 0);

  const duration =
    Number(
      track?.info?.duration ||
      track?.info?.length ||
      0
    );

  const requester =
    getRequester(track);

  const loop =
    getLoop(player);

  const embed =
    new EmbedBuilder()
      .setColor("#F0F0A0")
      .setAuthor({
        name: "Now Playing 🎵",
        iconURL:
          client.user.displayAvatarURL()
      })
      .setTitle(
        track?.info?.title ||
        "Unknown Song"
      );

  if (track?.info?.uri) {
    embed.setURL(track.info.uri);
  }

  if (track?.info?.artworkUrl) {
    embed.setThumbnail(
      track.info.artworkUrl
    );
  }

  embed
    .setDescription(
      `${createProgressBar(
        current,
        duration
      )}\n\`${formatTime(current)} / ${formatTime(duration)}\``
    )
    .addFields(
      {
        name: "👤 Artist",
        value:
          `\`${track?.info?.author || "Unknown"}\``,
        inline: true
      },
      {
        name: "⌛ Duration",
        value:
          `\`${formatTime(duration)}\``,
        inline: true
      },
      {
        name: "🎧 Requested by",
        value:
          requester
            ? `${requester}`
            : "Unknown",
        inline: true
      }
    )
    .setTimestamp()
    .setFooter({
      text:
        `Volume: ${player.volume ?? 100}% | Loop: ${
          loop === "none" ? "off" : loop
        }`,
      iconURL:
        requester?.displayAvatarURL?.() ||
        client.user.displayAvatarURL()
    });

  return embed;
}

function createButtons() {
  const row1 =
    new ActionRowBuilder().addComponents(
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

  const row2 =
    new ActionRowBuilder().addComponents(
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

async function sendMusicPanel(
  client,
  player,
  track
) {
  const channel =
    await client.channels
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

  const embed =
    createEmbed(
      client,
      player,
      track
    );

  const components =
    createButtons();

  let state =
    panels.get(guildId);

  if (state?.interval) {
    clearInterval(state.interval);
  }

  let message = state?.message;

  if (message) {
    try {
      await message.edit({
        embeds: [embed],
        components
      });
    } catch {
      message = null;
    }
  }

  if (!message) {
    message = await channel.send({
      embeds: [embed],
      components
    });
  }

  const interval =
    setInterval(async () => {
      if (
        !player ||
        !player.current
      ) {
        clearInterval(interval);
        return;
      }

      try {
        const updatedEmbed =
          createEmbed(
            client,
            player,
            player.current
          );

        await message.edit({
          embeds: [updatedEmbed],
          components: createButtons()
        });
      } catch {
        clearInterval(interval);
      }
    }, 10000);

  panels.set(guildId, {
    message,
    interval
  });
}

async function handleMusicButton(
  interaction,
  client
) {
  if (!interaction.isButton()) {
    return false;
  }

  if (
    !interaction.customId.startsWith(
      "music_"
    )
  ) {
    return false;
  }

  const player =
    client.riffy.players.get(
      interaction.guildId
    );

  if (
    !player ||
    !player.current
  ) {
    await interaction.reply({
      content:
        "❌ Nothing is playing.",
      ephemeral: true
    });

    return true;
  }

  try {
    await interaction.deferUpdate();

    switch (interaction.customId) {

      case "music_previous": {
        const previous =
          player.previous;

        if (!previous) {
          return interaction.followUp({
            content:
              "❌ No previous song found.",
            ephemeral: true
          });
        }

        const current =
          player.current;

        player.queue.unshift(current);
        player.queue.unshift(previous);

        player.stop();

        await player.play();

        break;
      }

      case "music_seek_back": {
        const newPosition =
          Math.max(
            0,
            Number(player.position || 0) -
              10000
          );

        player.seek(newPosition);

        break;
      }

      case "music_play_pause": {
        if (player.paused) {
          await player.pause(false);
        } else {
          await player.pause(true);
        }

        break;
      }

      case "music_seek_forward": {
        const duration =
          Number(
            player.current.info.duration ||
            player.current.info.length ||
            0
          );

        const newPosition =
          Math.min(
            duration,
            Number(player.position || 0) +
              10000
          );

        player.seek(newPosition);

        break;
      }

      case "music_skip": {
        player.stop();

        break;
      }

      case "music_volume_down": {
        const volume =
          Math.max(
            0,
            Number(player.volume || 100) -
              10
          );

        player.setVolume(volume);

        break;
      }

      case "music_volume_up": {
        const volume =
          Math.min(
            100,
            Number(player.volume || 100) +
              10
          );

        player.setVolume(volume);

        break;
      }

      case "music_loop": {
        const modes = [
          "none",
          "track",
          "queue"
        ];

        const current =
          getLoop(player);

        const index =
          modes.indexOf(current);

        const next =
          modes[
            (index + 1) % modes.length
          ];

        player.setLoop(next);

        break;
      }

      case "music_stop": {
        player.queue.clear();
        player.stop();

        break;
      }

      case "music_shuffle": {
        if (
          player.queue.length < 2
        ) {
          return interaction.followUp({
            content:
              "❌ Queue-তে shuffle করার মতো যথেষ্ট song নেই.",
            ephemeral: true
          });
        }

        player.queue.shuffle();

        break;
      }
    }

    // Panel immediately refresh
    const state =
      panels.get(
        interaction.guildId
      );

    if (state?.message) {
      const embed =
        createEmbed(
          client,
          player,
          player.current
        );

      await state.message.edit({
        embeds: [embed],
        components: createButtons()
      }).catch(() => {});
    }

  } catch (error) {
    console.error(
      "Music panel error:",
      error
    );

    if (
      interaction.deferred ||
      interaction.replied
    ) {
      await interaction.followUp({
        content:
          "❌ Control ব্যবহার করতে সমস্যা হয়েছে.",
        ephemeral: true
      }).catch(() => {});
    }
  }

  return true;
}

module.exports = {
  sendMusicPanel,
  handleMusicButton
};
