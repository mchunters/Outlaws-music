require("dotenv").config();

const {
  REST,
  Routes
} = require("discord.js");

const commands =
  require("./commands");

const commandData =
  Object.values(commands)
    .map(command =>
      command.data.toJSON()
    );

const rest =
  new REST({
    version: "10"
  })
  .setToken(
    process.env.DISCORD_TOKEN
  );

(async () => {

  try {

    console.log(
      `🔄 Deploying ${commandData.length} commands...`
    );

    await rest.put(

      Routes.applicationGuildCommands(

        process.env.CLIENT_ID,

        process.env.GUILD_ID

      ),

      {
        body: commandData
      }

    );

    console.log(
      "✅ Slash commands deployed!"
    );

  } catch (error) {

    console.error(
      "❌ Command deployment failed:",
      error
    );

    process.exit(1);

  }

})();
