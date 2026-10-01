const {
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

function getPlayer(client, guildId) {
  return client.riffy.players.get(guildId);
}

function getVoice(interaction) {
  return interaction.member?.voice?.channel;
}

async function safeReply(interaction, payload) {
  if (interaction.replied || interaction.deferred) {
    return interaction.followUp({
      ...payload,
      ephemeral: true
    });
  }

  return interaction.reply({
    ...payload,
    ephemeral: true
  });
}

const play = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song or playlist")
    .addStringOption(option =>
      option
        .setName("query")
        .setDescription("Song name or YouTube URL")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const voice = getVoice(interaction);

    if (!voice) {
      return safeReply(interaction, {
        content: "❌ Join a voice channel first."
      });
    }

    await interaction.deferReply({ ephemeral: true });

    let player = getPlayer(client, interaction.guildId);

    try {
      if (!player) {
        player = client.riffy.createConnection({
          guildId: interaction.guildId,
          voiceChannel: voice.id,
          textChannel: interaction.channelId,
          deaf: true
        });
      } else if (player.voiceChannel !== voice.id) {
        if (typeof player.setVoiceChannel === "function") {
          await player.setVoiceChannel(voice.id);
        }
      }

      const query = interaction.options.getString("query", true);

      const result = await client.riffy.resolve({
        query,
        requester: interaction.user
      });

      if (!result?.tracks?.length) {
        return interaction.editReply("❌ No songs were found.");
      }

      if (result.loadType === "playlist") {
        for (const track of result.tracks) {
          track.info.requester = interaction.user;
          player.queue.add(track);
        }

        await interaction.editReply(
          `📀 **${result.tracks.length}** songs have been added to the queue.`
        );
      } else {
        const track = result.tracks[0];
        track.info.requester = interaction.user;
        player.queue.add(track);

        await interaction.editReply(
          `🎵 **${track.info.title}** added to queue.`
        );
      }

      if (!player.playing && !player.paused) {
        await player.play();
      }
    } catch (error) {
      console.error("❌ Play Error:", error);

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(
          "❌ Music play করতে সমস্যা হয়েছে. Render logs check করুন."
        ).catch(() => {});
      }

      return safeReply(interaction, {
        content: "❌ Music play করতে সমস্যা হয়েছে."
      });
    }
  }
};

const skip = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip current song"),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guildId);

    if (!player?.current) {
      return safeReply(interaction, {
        content: "❌ No music is playing now."
      });
    }

    try {
      await player.stop();
      return safeReply(interaction, {
        content: "⏭️ Song skipped."
      });
    } catch (error) {
      console.error("❌ Skip Error:", error);
      return safeReply(interaction, {
        content: "❌ Skip করতে সমস্যা হয়েছে."
      });
    }
  }
};

const pause = {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pause music"),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guildId);

    if (!player?.current) {
      return safeReply(interaction, {
        content: "❌ No music is playing."
      });
    }

    try {
      await player.pause(true);
      return safeReply(interaction, {
        content: "⏸️ Music paused."
      });
    } catch (error) {
      console.error("❌ Pause Error:", error);
      return safeReply(interaction, {
        content: "❌ Pause করতে সমস্যা হয়েছে."
      });
    }
  }
};

const resume = {
  data: new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resume music"),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guildId);

    if (!player?.current) {
      return safeReply(interaction, {
        content: "❌ No song is paused."
      });
    }

    try {
      await player.pause(false);
      return safeReply(interaction, {
        content: "▶️ Music resumed."
      });
    } catch (error) {
      console.error("❌ Resume Error:", error);
      return safeReply(interaction, {
        content: "❌ Resume করতে সমস্যা হয়েছে."
      });
    }
  }
};

const stop = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop music and clear queue"),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guildId);

    if (!player) {
      return safeReply(interaction, {
        content: "❌ No music player."
      });
    }

    try {
      player.queue.clear();
      await player.stop();
      player.destroy();
    } catch (error) {
      console.error("❌ Stop Error:", error);
    }

    return safeReply(interaction, {
      content: "⏹️ Music stopped and queue cleared."
    });
  }
};

const queue = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show music queue"),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guildId);

    if (!player?.current) {
      return safeReply(interaction, {
        content: "📭 Queue empty."
      });
    }

    const upcoming = Array.from(player.queue).slice(0, 10);
    let description = `🎵 **Now Playing:** ${player.current.info.title}\n\n`;

    if (upcoming.length) {
      description += upcoming
        .map((track, index) => `${index + 1}. ${track.info.title}`)
        .join("\n");
    } else {
      description += "No upcoming songs.";
    }

    const embed = new EmbedBuilder()
      .setTitle("🎵 Outlaws Music Queue")
      .setDescription(description)
      .setColor(0x8b5cf6);

    return interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};

const shuffle = {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Shuffle queue"),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guildId);

    if (!player || player.queue.length < 2) {
      return safeReply(interaction, {
        content: "❌ Shuffle করার মতো যথেষ্ট গান নেই."
      });
    }

    try {
      player.queue.shuffle();
      return safeReply(interaction, {
        content: "🔀 Queue shuffled."
      });
    } catch (error) {
      console.error("❌ Shuffle Error:", error);
      return safeReply(interaction, {
        content: "❌ Queue shuffle করতে সমস্যা হয়েছে."
      });
    }
  }
};

const volume = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Change music volume")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Volume 0-100")
        .setMinValue(0)
        .setMaxValue(100)
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guildId);

    if (!player) {
      return safeReply(interaction, {
        content: "❌ Music player নেই."
      });
    }

    const amount = interaction.options.getInteger("amount", true);

    try {
      await player.setVolume(amount);
      return safeReply(interaction, {
        content: `🔊 Volume: **${amount}%**`
      });
    } catch (error) {
      console.error("❌ Volume Error:", error);
      return safeReply(interaction, {
        content: "❌ Volume change করতে সমস্যা হয়েছে."
      });
    }
  }
};

const loop = {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Change loop mode")
    .addStringOption(option =>
      option
        .setName("mode")
        .setDescription("Loop mode")
        .setRequired(true)
        .addChoices(
          { name: "Off", value: "none" },
          { name: "Track", value: "track" },
          { name: "Queue", value: "queue" }
        )
    ),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guildId);

    if (!player) {
      return safeReply(interaction, {
        content: "❌ Music player নেই."
      });
    }

    const mode = interaction.options.getString("mode", true);

    try {
      await player.setLoop(mode);
      return safeReply(interaction, {
        content: `🔁 Loop: **${mode}**`
      });
    } catch (error) {
      console.error("❌ Loop Error:", error);
      return safeReply(interaction, {
        content: "❌ Loop change করতে সমস্যা হয়েছে."
      });
    }
  }
};

const nowplaying = {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Show current song"),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guildId);

    if (!player?.current) {
      return safeReply(interaction, {
        content: "❌ কোনো গান চলছে না."
      });
    }

    const track = player.current;
    const embed = new EmbedBuilder()
      .setTitle("🎶 Now Playing")
      .setDescription(`**${track.info.title}**`)
      .addFields(
        {
          name: "Artist",
          value: track.info.author || "Unknown",
          inline: true
        },
        {
          name: "Requested By",
          value: track.info.requester?.username || "Unknown",
          inline: true
        }
      )
      .setColor(0x8b5cf6);

    if (track.info.artworkUrl) {
      embed.setThumbnail(track.info.artworkUrl);
    }

    if (track.info.uri) {
      embed.setURL(track.info.uri);
    }

    return interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};

const join = {
  data: new SlashCommandBuilder()
    .setName("join")
    .setDescription("Join your voice channel"),

  async execute(interaction, client) {
    const voice = getVoice(interaction);

    if (!voice) {
      return safeReply(interaction, {
        content: "❌ আগে voice channel-এ join করো."
      });
    }

    try {
      const existing = getPlayer(client, interaction.guildId);

      if (existing) {
        if (typeof existing.setVoiceChannel === "function") {
          await existing.setVoiceChannel(voice.id);
        }
      } else {
        client.riffy.createConnection({
          guildId: interaction.guildId,
          voiceChannel: voice.id,
          textChannel: interaction.channelId,
          deaf: true
        });
      }

      return safeReply(interaction, {
        content: "🔊 Voice channel-এ joined."
      });
    } catch (error) {
      console.error("❌ Join Error:", error);
      return safeReply(interaction, {
        content: "❌ Voice channel-এ join করতে সমস্যা হয়েছে."
      });
    }
  }
};

const leave = {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Leave voice channel"),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guildId);

    if (!player) {
      return safeReply(interaction, {
        content: "❌ আমি voice channel-এ নেই."
      });
    }

    try {
      player.destroy();
    } catch (error) {
      console.error("❌ Leave Error:", error);
    }

    return safeReply(interaction, {
      content: "👋 Voice channel থেকে বের হয়ে গেছি."
    });
  }
};

const autoplay = {
  data: new SlashCommandBuilder()
    .setName("autoplay")
    .setDescription("Enable or disable autoplay")
    .addBooleanOption(option =>
      option
        .setName("enabled")
        .setDescription("Enable autoplay")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const player = getPlayer(client, interaction.guildId);

    if (!player) {
      return safeReply(interaction, {
        content: "❌ Music player নেই."
      });
    }

    const enabled = interaction.options.getBoolean("enabled", true);

    if (typeof player.autoplay !== "function") {
      return safeReply(interaction, {
        content: "⚠️ এই Riffy configuration-এ autoplay available নেই."
      });
    }

    try {
      if (enabled) {
        player.autoplay(player);
      } else {
        player.autoplay = false;
      }

      return safeReply(interaction, {
        content: `🤖 Autoplay **${enabled ? "ON" : "OFF"}**`
      });
    } catch (error) {
      console.error("❌ Autoplay Error:", error);
      return safeReply(interaction, {
        content: "❌ Autoplay change করতে সমস্যা হয়েছে."
      });
    }
  }
};

module.exports = {
  play,
  skip,
  pause,
  resume,
  stop,
  queue,
  shuffle,
  volume,
  loop,
  nowplaying,
  join,
  leave,
  autoplay
};
