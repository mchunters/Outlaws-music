const {
  SlashCommandBuilder
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song")
    .addStringOption(option =>
      option
        .setName("query")
        .setDescription("YouTube URL or search")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.reply(
      "🎵 Music system is ready. `/play` received your request."
    );
  }
};
