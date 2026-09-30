const {
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

// =====================================
// GET PLAYER
// =====================================

function getPlayer(client, guildId) {

  return client.riffy.players.get(
    guildId
  );

}

// =====================================
// GET VOICE CHANNEL
// =====================================

function getVoice(interaction) {

  return interaction.member?.voice?.channel;

}

// =====================================
// PLAY
// =====================================

const play = {

  data: new SlashCommandBuilder()

    .setName("play")

    .setDescription(
      "Play a song or playlist"
    )

    .addStringOption(option =>
      option
        .setName("query")
        .setDescription(
          "Song name or YouTube URL"
        )
        .setRequired(true)
    ),

  async execute(
    interaction,
    client
  ) {

    const voice =
      getVoice(interaction);

    if (!voice) {

      return interaction.reply({
        content:
          "❌ Join a voice channel first.",
        ephemeral: true
      });

    }

    await interaction.deferReply();

    let player =
      getPlayer(
        client,
        interaction.guildId
      );

    if (!player) {

      player =
        client.riffy.createConnection({
          guildId:
            interaction.guildId,

          voiceChannel:
            voice.id,

          textChannel:
            interaction.channelId,

          deaf: true
        });

    }

    const query =
      interaction.options.getString(
        "query"
      );

    const result =
      await client.riffy.resolve({
        query: query,

        requester:
          interaction.user
      });

    if (
      !result ||
      !result.tracks ||
      result.tracks.length === 0
    ) {

      return interaction.editReply(
        "❌ No songs were found."
      );

    }

    // PLAYLIST

    if (
      result.loadType ===
      "playlist"
    ) {

      for (
        const track of result.tracks
      ) {

        track.info.requester =
          interaction.user;

        player.queue.add(
          track
        );

      }

      await interaction.editReply(
        `📀 **${result.tracks.length}** The song has been added to the queue.`
      );

    }

    // SINGLE TRACK

    else {

      const track =
        result.tracks[0];

      track.info.requester =
        interaction.user;

      player.queue.add(
        track
      );

      await interaction.editReply(
        `🎵 **${track.info.title}** Added to queue.`
      );

    }

    if (
      !player.playing &&
      !player.paused
    ) {

      await player.play();

    }

  }
};

// =====================================
// SKIP
// =====================================

const skip = {

  data: new SlashCommandBuilder()

    .setName("skip")

    .setDescription(
      "Skip current song"
    ),

  async execute(
    interaction,
    client
  ) {

    const player =
      getPlayer(
        client,
        interaction.guildId
      );

    if (
      !player ||
      !player.current
    ) {

      return interaction.reply(
        "❌ No music is playing now."
      );

    }

    await player.stop();

    await interaction.reply(
      "⏭️ Song skipped."
    );

  }
};

// =====================================
// PAUSE
// =====================================

const pause = {

  data: new SlashCommandBuilder()

    .setName("pause")

    .setDescription(
      "Pause music"
    ),

  async execute(
    interaction,
    client
  ) {

    const player =
      getPlayer(
        client,
        interaction.guildId
      );

    if (
      !player ||
      !player.current
    ) {

      return interaction.reply(
        "❌ No music is playing."
      );

    }

    await player.pause(true);

    await interaction.reply(
      "⏸️ Music paused."
    );

  }
};

// =====================================
// RESUME
// =====================================

const resume = {

  data: new SlashCommandBuilder()

    .setName("resume")

    .setDescription(
      "Resume music"
    ),

  async execute(
    interaction,
    client
  ) {

    const player =
      getPlayer(
        client,
        interaction.guildId
      );

    if (
      !player ||
      !player.current
    ) {

      return interaction.reply(
        "❌ No song is paused."
      );

    }

    await player.pause(false);

    await interaction.reply(
      "▶️ Music resumed."
    );

  }
};

// =====================================
// STOP
// =====================================

const stop = {

  data: new SlashCommandBuilder()

    .setName("stop")

    .setDescription(
      "Stop music and clear queue"
    ),

  async execute(
    interaction,
    client
  ) {

    const player =
      getPlayer(
        client,
        interaction.guildId
      );

    if (!player) {

      return interaction.reply(
        "❌ No music player."
      );

    }

    player.queue.clear();

    await player.stop();

    player.destroy();

    await interaction.reply(
      "⏹️ Music stopped এবং queue cleared."
    );

  }
};

// =====================================
// QUEUE
// =====================================

const queue = {

  data: new SlashCommandBuilder()

    .setName("queue")

    .setDescription(
      "Show music queue"
    ),

  async execute(
    interaction,
    client
  ) {

    const player =
      getPlayer(
        client,
        interaction.guildId
      );

    if (
      !player ||
      !player.current
    ) {

      return interaction.reply(
        "📭 Queue empty."
      );

    }

    const upcoming =
      player.queue.slice(0, 10);

    let description =
      `🎵 **Now Playing:** ${player.current.info.title}\n\n`;

    if (upcoming.length) {

      description +=
        upcoming
          .map(
            (track, index) =>
              `${index + 1}. ${track.info.title}`
          )
          .join("\n");

    } else {

      description +=
        "No upcoming songs.";

    }

    const embed =
      new EmbedBuilder()

        .setTitle(
          "🎵 Outlaws Music Queue"
        )

        .setDescription(
          description
        )

        .setColor(
          0x8b5cf6
        );

    await interaction.reply({
      embeds: [embed]
    });

  }
};

// =====================================
// SHUFFLE
// =====================================

const shuffle = {

  data: new SlashCommandBuilder()

    .setName("shuffle")

    .setDescription(
      "Shuffle queue"
    ),

  async execute(
    interaction,
    client
  ) {

    const player =
      getPlayer(
        client,
        interaction.guildId
      );

    if (
      !player ||
      player.queue.size < 2
    ) {

      return interaction.reply(
        "❌ Shuffle করার মতো যথেষ্ট গান নেই."
      );

    }

    player.queue.shuffle();

    await interaction.reply(
      "🔀 Queue shuffled."
    );

  }
};

// =====================================
// VOLUME
// =====================================

const volume = {

  data: new SlashCommandBuilder()

    .setName("volume")

    .setDescription(
      "Change music volume"
    )

    .addIntegerOption(option =>
      option

        .setName("amount")

        .setDescription(
          "Volume 0-100"
        )

        .setMinValue(0)

        .setMaxValue(100)

        .setRequired(true)
    ),

  async execute(
    interaction,
    client
  ) {

    const player =
      getPlayer(
        client,
        interaction.guildId
      );

    if (!player) {

      return interaction.reply(
        "❌ Music player নেই."
      );

    }

    const amount =
      interaction.options.getInteger(
        "amount"
      );

    await player.setVolume(
      amount
    );

    await interaction.reply(
      `🔊 Volume: **${amount}%**`
    );

  }
};

// =====================================
// LOOP
// =====================================

const loop = {

  data: new SlashCommandBuilder()

    .setName("loop")

    .setDescription(
      "Change loop mode"
    )

    .addStringOption(option =>
      option

        .setName("mode")

        .setDescription(
          "Loop mode"
        )

        .setRequired(true)

        .addChoices(
          {
            name: "Off",
            value: "none"
          },
          {
            name: "Track",
            value: "track"
          },
          {
            name: "Queue",
            value: "queue"
          }
        )
    ),

  async execute(
    interaction,
    client
  ) {

    const player =
      getPlayer(
        client,
        interaction.guildId
      );

    if (!player) {

      return interaction.reply(
        "❌ Music player নেই."
      );

    }

    const mode =
      interaction.options.getString(
        "mode"
      );

    if (
      typeof player.setLoop ===
      "function"
    ) {

      await player.setLoop(
        mode
      );

    } else if (
      typeof player.setLoopMode ===
      "function"
    ) {

      await player.setLoopMode(
        mode
      );

    } else {

      return interaction.reply(
        "⚠️ এই Riffy version-এ loop API নেই."
      );

    }

    await interaction.reply(
      `🔁 Loop: **${mode}**`
    );

  }
};

// =====================================
// NOW PLAYING
// =====================================

const nowplaying = {

  data: new SlashCommandBuilder()

    .setName("nowplaying")

    .setDescription(
      "Show current song"
    ),

  async execute(
    interaction,
    client
  ) {

    const player =
      getPlayer(
        client,
        interaction.guildId
      );

    if (
      !player ||
      !player.current
    ) {

      return interaction.reply(
        "❌ কোনো গান চলছে না."
      );

    }

    const track =
      player.current;

    const embed =
      new EmbedBuilder()

        .setTitle(
          "🎶 Now Playing"
        )

        .setDescription(
          `**${track.info.title}**`
        )

        .addFields(
          {
            name: "Artist",
            value:
              track.info.author ||
              "Unknown",
            inline: true
          },
          {
            name: "Requested By",
            value:
              track.info.requester?.username ||
              "Unknown",
            inline: true
          }
        )

        .setColor(
          0x8b5cf6
        );

    await interaction.reply({
      embeds: [embed]
    });

  }
};

// =====================================
// JOIN
// =====================================

const join = {

  data: new SlashCommandBuilder()

    .setName("join")

    .setDescription(
      "Join your voice channel"
    ),

  async execute(
    interaction,
    client
  ) {

    const voice =
      getVoice(interaction);

    if (!voice) {

      return interaction.reply({
        content:
          "❌ আগে voice channel-এ join করো.",
        ephemeral: true
      });

    }

    client.riffy.createConnection({

      guildId:
        interaction.guildId,

      voiceChannel:
        voice.id,

      textChannel:
        interaction.channelId,

      deaf: true

    });

    await interaction.reply(
      "🔊 Voice channel-এ joined."
    );

  }
};

// =====================================
// LEAVE
// =====================================

const leave = {

  data: new SlashCommandBuilder()

    .setName("leave")

    .setDescription(
      "Leave voice channel"
    ),

  async execute(
    interaction,
    client
  ) {

    const player =
      getPlayer(
        client,
        interaction.guildId
      );

    if (!player) {

      return interaction.reply(
        "❌ আমি voice channel-এ নেই."
      );

    }

    player.destroy();

    await interaction.reply(
      "👋 Voice channel থেকে বের হয়ে গেছি."
    );

  }
};

// =====================================
// AUTOPLAY
// =====================================

const autoplay = {

  data: new SlashCommandBuilder()

    .setName("autoplay")

    .setDescription(
      "Enable or disable autoplay"
    )

    .addBooleanOption(option =>
      option

        .setName("enabled")

        .setDescription(
          "Enable autoplay"
        )

        .setRequired(true)
    ),

  async execute(
    interaction,
    client
  ) {

    const player =
      getPlayer(
        client,
        interaction.guildId
      );

    if (!player) {

      return interaction.reply(
        "❌ Music player নেই."
      );

    }

    const enabled =
      interaction.options.getBoolean(
        "enabled"
      );

    if (
      typeof player.autoplay !==
      "function"
    ) {

      return interaction.reply(
        "⚠️ এই Riffy configuration-এ autoplay available নেই."
      );

    }

    player.autoplay(
      enabled
    );

    await interaction.reply(
      `🤖 Autoplay **${
        enabled
          ? "ON"
          : "OFF"
      }**`
    );

  }
};

// =====================================
// EXPORT
// =====================================

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
