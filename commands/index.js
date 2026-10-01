const {
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

// =====================================
// GET PLAYER
// =====================================

function getPlayer(client, guildId) {
  return client.riffy.players.get(guildId);
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
      return interaction.reply({
        content: "❌ Join a voice channel first.",
        ephemeral: true
      });
    }

    await interaction.deferReply({
      ephemeral: true
    });

    let player = getPlayer(
      client,
      interaction.guildId
    );

    if (!player) {
      player = client.riffy.createConnection({
        guildId: interaction.guildId,
        voiceChannel: voice.id,
        textChannel: interaction.channelId,
        deaf: true
      });
    }

    const query = interaction.options.getString("query");

    const result = await client.riffy.resolve({
      query: query,
      requester: interaction.user
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

    // =====================================
    // PLAYLIST
    // =====================================

    if (result.loadType === "playlist") {
      for (const track of result.tracks) {
        track.info.requester = interaction.user;

        player.queue.add(track);
      }

      await interaction.editReply(
        `📀 **${result.tracks.length}** songs have been added to the queue.`
      );
    }

    // =====================================
    // SINGLE TRACK
    // =====================================

    else {
      const track = result.tracks[0];

      track.info.requester = interaction.user;

      player.queue.add(track);

      await interaction.editReply(
        `🎵 **${track.info.title}** added to queue.`
      );
    }

    // =====================================
    // START PLAYER
    // =====================================

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
    .setDescription("Skip current song"),

  async execute(interaction, client) {
    const player = getPlayer(
      client,
      interaction.guildId
    );

    if (!player || !player.current) {
      return interaction.reply({
        content: "❌ No music is playing now.",
        ephemeral: true
      });
    }

    await player.stop();

    await interaction.reply({
      content: "⏭️ Song skipped.",
      ephemeral: true
    });
  }
};

// =====================================
// PAUSE
// =====================================

const pause = {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pause music"),

  async execute(interaction, client) {
    const player = getPlayer(
      client,
      interaction.guildId
    );

    if (!player || !player.current) {
      return interaction.reply({
        content: "❌ No music is playing.",
        ephemeral: true
      });
    }

    await player.pause(true);

    await interaction.reply({
      content: "⏸️ Music paused.",
      ephemeral: true
    });
  }
};

// =====================================
// RESUME
// =====================================

const resume = {
  data: new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resume music"),

  async execute(interaction, client) {
    const player = getPlayer(
      client,
      interaction.guildId
    );

    if (!player || !player.current) {
      return interaction.reply({
        content: "❌ No song is paused.",
        ephemeral: true
      });
    }

    await player.pause(false);

    await interaction.reply({
      content: "▶️ Music resumed.",
      ephemeral: true
    });
  }
};

// =====================================
// STOP
// =====================================

const stop = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop music and clear queue"),

  async execute(interaction, client) {
    const player = getPlayer(
      client,
      interaction.guildId
    );

    if (!player) {
      return interaction.reply({
        content: "❌ No music player.",
        ephemeral: true
      });
    }

    player.queue.clear();

    await player.stop();

    player.destroy();

    await interaction.reply({
      content: "⏹️ Music stopped and queue cleared.",
      ephemeral: true
    });
  }
};

// =====================================
// QUEUE
// =====================================

const queue = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show music queue"),

  async execute(interaction, client) {
    const player = getPlayer(
      client,
      interaction.guildId
    );

    if (!player || !player.current) {
      return interaction.reply({
        content: "📭 Queue empty.",
        ephemeral: true
      });
    }

    const upcoming = player.queue.slice(0, 10);

    let description =
      `🎵 **Now Playing:** ${player.current.info.title}\n\n`;

    if (upcoming.length) {
      description += upcoming
        .map(
          (track, index) =>
            `${index + 1}. ${track.info.title}`
        )
        .join("\n");
    } else {
      description += "No upcoming songs.";
    }

    const embed = new EmbedBuilder()
      .setTitle("🎵 Outlaws Music Queue")
      .setDescription(description)
      .setColor(0x8b5cf6);

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};

// =====================================
// SHUFFLE
// =====================================

const shuffle = {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Shuffle queue"),

  async execute(interaction, client) {
    const player = getPlayer(
      client,
      interaction.guildId
    );

    if (
      !player ||
      player.queue.length < 2
    ) {
      return interaction.reply({
        content:
          "❌ Shuffle করার মতো যথেষ্ট গান নেই.",
        ephemeral: true
      });
    }

    player.queue.shuffle();

    await interaction.reply({
      content: "🔀 Queue shuffled.",
      ephemeral: true
    });
  }
};

// =====================================
// VOLUME
// =====================================

const volume = {
  data: new
