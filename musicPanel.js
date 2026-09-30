const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const panels = new Map();

const states = new Map();

function getState(guildId) {
  if (!states.has(guildId)) {
    states.set(guildId, {
      volume: 100,
      loop: "none",
      current: null,
      history: [],
      goingPrevious: false
    });
  }

  return states.get(guildId);
}

function duration(ms) {
  if (!ms || ms <= 0) return "Live";

  const total = Math.floor(ms / 1000);

  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function createPanel(player, track, state) {

  const queue =
    Array.from(player.queue || []).slice(0, 5);

  const queueText =
    queue.length
      ? queue
          .map(
            (song, index) =>
              `${index + 1}. ${song.info.title}`
          )
          .join("\n")
      : "No upcoming songs.";

  const loop =
    state.loop === "track"
      ? "Track"
      : state.loop === "queue"
      ? "Queue"
      : "Off";

  const embed =
    new EmbedBuilder()
      .setTitle("🎵 OUTLAWS MUSIC")
      .setDescription(
        `### 🎶 ${track?.info?.title || "Nothing playing"}\n\n` +
        `👤 **Artist:** ${
          track?.info?.author || "Unknown"
        }\n` +
        `⏱️ **Duration:** ${
          duration(track?.info?.length)
        }\n` +
        `🙋 **Requested by:** ${
          track?.info?.requester?.username || "Unknown"
        }\n\n` +
        `🔊 **Volume:** ${state.volume}%\n` +
        `🔁 **Loop:** ${loop}\n\n` +
        `### 📋 Up Next\n${queueText}`
      )
      .setColor(0x8b5cf6);

  if (track?.info?.artworkUrl) {
    embed.setThumbnail(track.info.artworkUrl);
  }

  const row1 =
    new ActionRowBuilder().addComponents(

      new ButtonBuilder()
        .setCustomId("music_previous")
        .setEmoji("⏮️")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("music_pause")
        .setEmoji(
          player.paused
            ? "▶️"
            : "⏸️"
        )
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("music_skip")
        .setEmoji("⏭️")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("music_stop")
        .setEmoji("⏹️")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId("music_queue")
        .setEmoji("📋")
        .setStyle(ButtonStyle.Secondary)
    );

  const row2 =
    new ActionRowBuilder().addComponents(

      new ButtonBuilder()
        .setCustomId("music_shuffle")
        .setEmoji("🔀")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("music_loop")
        .setEmoji("🔁")
        .setStyle(
          state.loop === "none"
            ? ButtonStyle.Secondary
            : ButtonStyle.Success
        ),

      new ButtonBuilder()
        .setCustomId("music_vol_down")
        .setEmoji("🔉")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("music_vol_up")
        .setEmoji("🔊")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("music_refresh")
        .setEmoji("🔄")
        .setStyle(ButtonStyle.Secondary)
    );

  return {
    embeds: [embed],
    components: [row1, row2]
  };
}

async function sendMusicPanel(
  client,
  player,
  track
) {

  const channel =
    client.channels.cache.get(
      player.textChannel
    );

  if (!channel) return;

  const guildId = player.guildId;

  const state =
    getState(guildId);

  if (
    state.current &&
    state.current.info?.uri !== track.info?.uri &&
    !state.goingPrevious
  ) {

    state.history.push(
      state.current
    );

    if (state.history.length > 10) {
      state.history.shift();
    }
  }

  state.current = track;

  state.goingPrevious = false;

  const payload =
    createPanel(
      player,
      track,
      state
    );

  const oldMessageId =
    panels.get(guildId);

  if (oldMessageId) {

    try {

      const message =
        await channel.messages.fetch(
          oldMessageId
        );

      await message.edit(
        payload
      );

      return;

    } catch {}
  }

  const message =
    await channel.send(
      payload
    );

  panels.set(
    guildId,
    message.id
  );
}

async function handleMusicButton(
  interaction,
  client
) {

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
        "❌ এখন কোনো গান চলছে না.",
      ephemeral: true
    });

    return true;
  }

  const state =
    getState(
      interaction.guildId
    );

  try {

    switch (
      interaction.customId
    ) {

      // =========================
      // PAUSE / RESUME
      // =========================

      case "music_pause":

        await player.pause(
          !player.paused
        );

        break;


      // =========================
      // SKIP
      // =========================

      case "music_skip":

        await player.stop();

        break;


      // =========================
      // STOP
      // =========================

      case "music_stop":

        player.queue.clear();

        await player.stop();

        player.destroy();

        panels.delete(
          interaction.guildId
        );

        await interaction.update({
          content:
            "⏹️ Music stopped.",
          embeds: [],
          components: []
        });

        return true;


      // =========================
      // PREVIOUS
      // =========================

      case "music_previous": {

        const previous =
          state.history.pop();

        if (!previous) {

          await interaction.reply({
            content:
              "⏮️ Previous song পাওয়া যায়নি.",
            ephemeral: true
          });

          return true;
        }

        state.goingPrevious = true;

        player.queue.unshift(
          previous
        );

        await player.stop();

        break;
      }


      // =========================
      // SHUFFLE
      // =========================

      case "music_shuffle":

        if (
          player.queue.size < 2
        ) {

          await interaction.reply({
            content:
              "❌ Shuffle করার মতো যথেষ্ট গান নেই.",
            ephemeral: true
          });

          return true;
        }

        player.queue.shuffle();

        break;


      // =========================
      // LOOP
      // =========================

      case "music_loop":

        if (
          state.loop === "none"
        ) {

          state.loop = "track";

        } else if (
          state.loop === "track"
        ) {

          state.loop = "queue";

        } else {

          state.loop = "none";

        }

        if (
          typeof player.setLoop ===
          "function"
        ) {

          await player.setLoop(
            state.loop
          );

        } else if (
          typeof player.setLoopMode ===
          "function"
        ) {

          await player.setLoopMode(
            state.loop
          );
        }

        break;


      // =========================
      // VOLUME DOWN
      // =========================

      case "music_vol_down":

        state.volume =
          Math.max(
            0,
            state.volume - 10
          );

        await player.setVolume(
          state.volume
        );

        break;


      // =========================
      // VOLUME UP
      // =========================

      case "music_vol_up":

        state.volume =
          Math.min(
            100,
            state.volume + 10
          );

        await player.setVolume(
          state.volume
        );

        break;


      // =========================
      // QUEUE
      // =========================

      case "music_queue": {

        const queue =
          Array.from(
            player.queue || []
          ).slice(0, 10);

        const text =
          queue.length
            ? queue
                .map(
                  (song, index) =>
                    `${index + 1}. ${song.info.title}`
                )
                .join("\n")
            : "No upcoming songs.";

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                "📋 Outlaws Music Queue"
              )
              .setDescription(
                text
              )
              .setColor(
                0x8b5cf6
              )
          ],
          ephemeral: true
        });

        return true;
      }


      // =========================
      // REFRESH
      // =========================

      case "music_refresh":

        break;

      default:

        return false;
    }

    await interaction.update(
      createPanel(
        player,
        player.current,
        state
      )
    );

    return true;

  } catch (error) {

    console.error(
      "Music button error:",
      error
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {

      await interaction.reply({
        content:
          "❌ এই control কাজ করাতে সমস্যা হয়েছে.",
        ephemeral: true
      }).catch(() => {});
    }

    return true;
  }
}

module.exports = {
  sendMusicPanel,
  handleMusicButton
};
