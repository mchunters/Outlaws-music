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


// ======================================================
// WEB SERVER
// ======================================================

const app = express();

const PORT = Number(
  process.env.PORT || 10000
);

app.get("/", (req, res) => {
  res.status(200).send(
    "🎵 Outlaws Music Bot is Online!"
  );
});

app.get("/health", (req, res) => {

  const nodes = client.riffy?.nodes
    ? Array.from(
        client.riffy.nodes.values()
      ).map(node => ({
        name: node.name,
        host: node.host,
        port: node.port,
        connected: node.connected
      }))
    : [];

  res.json({
    status: "online",
    bot: client.user?.tag || "starting",
    lavalink: nodes
  });
});

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `🌐 Web server running on port ${PORT}`
    );
  }
);


// ======================================================
// DISCORD CLIENT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});


// ======================================================
// ENVIRONMENT HELPERS
// ======================================================

function envValue(
  name,
  fallback = ""
) {

  const value = process.env[name];

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  return String(value)
    .trim()
    .replace(/^["'](.*)["']$/, "$1");
}


function envBool(
  name,
  fallback = false
) {

  return (
    envValue(
      name,
      String(fallback)
    ).toLowerCase() === "true"
  );
}


// ======================================================
// LAVALINK V4 CONFIGURATION
// ======================================================

const nodes = [

  {
    name: "Main",

    host: envValue(
      "LAVALINK_HOST"
    ),

    port: Number(
      envValue(
        "LAVALINK_PORT",
        "2333"
      )
    ),

    password: envValue(
      "LAVALINK_PASSWORD"
    ),

    secure: envBool(
      "LAVALINK_SECURE",
      false
    )
  }

];


// ======================================================
// OPTIONAL FALLBACK NODE
// ======================================================

if (
  envValue(
    "LAVALINK_FALLBACK_HOST"
  )
) {

  nodes.push({

    name: "Fallback",

    host: envValue(
      "LAVALINK_FALLBACK_HOST"
    ),

    port: Number(
      envValue(
        "LAVALINK_FALLBACK_PORT",
        "2333"
      )
    ),

    password: envValue(
      "LAVALINK_FALLBACK_PASSWORD"
    ),

    secure: envBool(
      "LAVALINK_FALLBACK_SECURE",
      false
    )

  });

}


// ======================================================
// CHECK LAVALINK CONFIG
// ======================================================

const invalidNode =
  nodes.find(
    node =>
      !node.host ||
      !node.password ||
      !Number.isFinite(node.port)
  );


if (invalidNode) {

  console.error(
    "❌ Lavalink configuration is incomplete."
  );

  console.error(
    "Required environment variables:"
  );

  console.error(
    "LAVALINK_HOST"
  );

  console.error(
    "LAVALINK_PORT"
  );

  console.error(
    "LAVALINK_PASSWORD"
  );

  console.error(
    "LAVALINK_SECURE"
  );

  process.exit(1);
}


// ======================================================
// SHOW SAFE LAVALINK CONFIG
// PASSWORD IS NEVER PRINTED
// ======================================================

console.log(
  "🎧 Lavalink configuration:"
);

console.log(
  nodes.map(node => ({
    name: node.name,
    host: node.host,
    port: node.port,
    secure: node.secure
  }))
);


// ======================================================
// RIFFY - LAVALINK V4
// ======================================================

client.riffy = new Riffy(
  client,
  nodes,
  {

    send: payload => {

      const guild =
        client.guilds.cache.get(
          payload.d.guild_id
        );

      if (guild) {

        guild.shard.send(
          payload
        );

      }

    },

    defaultSearchPlatform:
      "ytmsearch",

    restVersion:
      "v4"

  }
);


// ======================================================
// COMMANDS
// ======================================================

const commands =
  require("./commands");


// ======================================================
// DISCORD READY
// ======================================================

client.once(
  "ready",
  () => {

    console.log(
      `✅ Logged in as ${client.user.tag}`
    );

    try {

      client.riffy.init(
        client.user.id
      );

      console.log(
        "🎵 Riffy initialized."
      );

    } catch (error) {

      console.error(
        "❌ Riffy initialization error:",
        error
      );

    }


    client.user.setPresence({

      activities: [

        {
          name: "🎵 Outlaws Music",
          type: 2
        }

      ],

      status: "online"

    });

  }
);


// ======================================================
// DISCORD VOICE STATE
// ======================================================

client.on(
  "raw",
  data => {

    if (
      data.t !==
        GatewayDispatchEvents.VoiceStateUpdate &&
      data.t !==
        GatewayDispatchEvents.VoiceServerUpdate
    ) {

      return;

    }

    try {

      client.riffy.updateVoiceState(
        data
      );

    } catch (error) {

      console.error(
        "❌ Voice state update error:",
        error
      );

    }

  }
);


// ======================================================
// INTERACTIONS
// ======================================================

client.on(
  "interactionCreate",
  async interaction => {

    try {

      // ================================================
      // MUSIC PANEL BUTTONS
      // ================================================

      if (
        interaction.isButton()
      ) {

        const handled =
          await handleMusicButton(
            interaction,
            client
          );

        if (handled) {

          return;

        }

      }


      // ================================================
      // SLASH COMMANDS
      // ================================================

      if (
        !interaction.isChatInputCommand()
      ) {

        return;

      }


      const command =
        commands[
          interaction.commandName
        ];


      if (!command) {

        return;

      }


      await command.execute(
        interaction,
        client
      );

    } catch (error) {

      console.error(
        "❌ Interaction Error:",
        error
      );


      const message =
        "❌ Something went wrong. Check Render logs.";


      try {

        if (
          interaction.replied ||
          interaction.deferred
        ) {

          await interaction.followUp({

            content:
              message,

            ephemeral:
              true

          });

        } else {

          await interaction.reply({

            content:
              message,

            ephemeral:
              true

          });

        }

      } catch {}

    }

  }
);


// ======================================================
// LAVALINK CONNECTED
// ======================================================

client.riffy.on(
  "nodeConnect",
  node => {

    console.log(
      `🟢 Lavalink v4 Connected: ${node.name} (${node.host}:${node.port})`
    );

  }
);


// ======================================================
// LAVALINK ERROR
// ======================================================

client.riffy.on(
  "nodeError",
  (node, error) => {

    console.error(
      `🔴 Lavalink Error (${node.name}):`,
      error?.message || error
    );


    // ================================================
    // 401 AUTH ERROR
    // ================================================

    if (
      error?.message?.includes(
        "401"
      )
    ) {

      console.error(
        "🔐 Lavalink returned 401 Unauthorized."
      );

      console.error(
        "👉 Check LAVALINK_PASSWORD."
      );

      console.error(
        "👉 Check LAVALINK_HOST."
      );

      console.error(
        "👉 Do NOT put https:// or http:// inside LAVALINK_HOST."
      );

    }

  }
);


// ======================================================
// LAVALINK DISCONNECT
// ======================================================

client.riffy.on(
  "nodeDisconnect",
  node => {

    console.warn(
      `🟠 Lavalink Disconnected: ${node.name}`
    );

  }
);


// ======================================================
// TRACK START
// ======================================================

client.riffy.on(
  "trackStart",
  async (
    player,
    track
  ) => {

    console.log(
      `🎵 Playing: ${track.info.title}`
    );


    try {

      await sendMusicPanel(
        client,
        player,
        track
      );

    } catch (error) {

      console.error(
        "❌ Music Panel Error:",
        error
      );

    }

  }
);


// ======================================================
// QUEUE END
// ======================================================

client.riffy.on(
  "queueEnd",
  async player => {

    console.log(
      "📭 Queue finished."
    );


    try {

      await clearMusicPanel(
        client,
        player.guildId
      );

    } catch (error) {

      console.error(
        "❌ Panel clear error:",
        error
      );

    }


    try {

      player.destroy();

    } catch (error) {

      console.error(
        "❌ Player destroy error:",
        error
      );

    }

  }
);


// ======================================================
// UNHANDLED REJECTION
// ======================================================

process.on(
  "unhandledRejection",
  error => {

    console.error(
      "❌ Unhandled Rejection:",
      error
    );

  }
);


// ======================================================
// UNCAUGHT EXCEPTION
// ======================================================

process.on(
  "uncaughtException",
  error => {

    console.error(
      "❌ Uncaught Exception:",
      error
    );

  }
);


// ======================================================
// DISCORD TOKEN CHECK
// ======================================================

if (
  !process.env.DISCORD_TOKEN
) {

  console.error(
    "❌ DISCORD_TOKEN is missing from environment variables."
  );

  process.exit(1);

}


// ======================================================
// LOGIN
// ======================================================

client.login(
  process.env.DISCORD_TOKEN
);
