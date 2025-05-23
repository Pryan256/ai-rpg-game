const express = require('express');
const cors = require('cors');
const fs = require('fs');
const app = express();
const port = 3001;

require('dotenv').config();
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const sessions = {}; // 🧠 Stores memory per session

app.use(cors({
  origin: 'https://dancing-dolphin-3d57e1.netlify.app',
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

function getDefaultMemory() {
  return {
    playerName: '',
    lastPlayerMessage: '',
    lastDMPrompt: '',
    quest: '',
    knownItems: [],
    knownCharacters: [],
    knownLocations: [],
    knownLaws: [],
    highlights: []
  };
}

// 💬 Handle player message
app.post('/message', async (req, res) => {
  const { name, message, sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

  // 🧠 Initialize session if needed
  if (!sessions[sessionId]) sessions[sessionId] = getDefaultMemory();
  const memory = sessions[sessionId];

  memory.playerName = name;
  memory.lastPlayerMessage = message;

  const playerState = {
    name,
    race: 'Elf',
    class: 'Wizard',
    level: 2,
    hp: 14,
    stats: {
      STR: 8,
      DEX: 14,
      CON: 12,
      INT: 16,
      WIS: 10,
      CHA: 10,
    },
    inventory: ['Spellbook', 'Staff', 'Potion of Healing']
  };

  const prompt = `You are the Dungeon Master for a Dungeons & Dragons 5e fantasy roleplaying game.

The player is:
- Name: ${playerState.name}
- Race: ${playerState.race}
- Class: ${playerState.class}
- Level: ${playerState.level}
- HP: ${playerState.hp}
- Stats: STR ${playerState.stats.STR}, DEX ${playerState.stats.DEX}, CON ${playerState.stats.CON}, INT ${playerState.stats.INT}, WIS ${playerState.stats.WIS}, CHA ${playerState.stats.CHA}
- Inventory: ${playerState.inventory.join(', ')}

🧠 Memory from previous exchanges:
- Last player message: ${memory.lastPlayerMessage}
- Last DM prompt: ${memory.lastDMPrompt || 'N/A'}
- Current quest objective: ${memory.quest || 'Not yet established'}
- Known items: ${memory.knownItems.join(', ') || 'None'}
- Known characters: ${memory.knownCharacters.join(', ') || 'None'}
- Known locations: ${memory.knownLocations.join(', ') || 'None'}
- Known laws: ${memory.knownLaws.join(', ') || 'None'}

🎭 DM Guidelines:
- Only narrate the world, never describe the player taking action unless they explicitly say so.
- If a player asks about something that might require a skill check (like identifying a plant or sensing danger), ask them to roll for it.
- Use the phrase: "Make a [Skill] check (DC [number])."
- Do NOT roll for the player. Wait for them to respond with their result.
- After receiving their roll, narrate success or failure accordingly.
- Be sure to clearly separate story text from choices.

🧠 Always respond only to the player's latest input. Continue the story logically.

📜 End each response with 2 to 4 short, clear choices the player can take next.

Use this format:
Story text...

Choices:
- Choice one
- Choice two
- Choice three`;

  try {
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: message }
      ],
    });

    const raw = chatResponse.choices[0].message.content;
    memory.lastDMPrompt = raw;

    const [storyPart, choicePart] = raw.split(/Choices:/i);
    const choices = choicePart
      ? choicePart.trim().split(/\n|-/).map(line => line.trim()).filter(line => line.length > 0)
      : [];

    res.json({
      response: storyPart.trim(),
      options: choices
    });
  } catch (error) {
    console.error('❌ OpenAI Error:', error);
    res.status(500).send('Something went wrong talking to the Dungeon Master.');
  }
});

// 🧼 Clear session memory
app.post('/clear-memory', (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || !sessions[sessionId]) {
    return res.status(400).json({ success: false, error: 'Invalid session ID' });
  }

  sessions[sessionId] = getDefaultMemory();
  console.log(`🧠 Memory cleared for session ${sessionId}`);
  res.json({ success: true });
});

// 🧠 Extract memory from DM story text
app.post('/extract-memory', async (req, res) => {
  const { text, sessionId } = req.body;
  if (!sessionId || !sessions[sessionId]) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  const memory = sessions[sessionId];

  try {
    const extractResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a memory extraction assistant for a D&D game.
Given a block of story text from a Dungeon Master, extract any notable:

1. 🎯 Quest (if mentioned or implied)
2. 🧑‍🤝‍🧑 Named characters (e.g., "Thrain Steelgrip")
3. 🎒 Named magical or special items
4. 🗺 Named locations (e.g., "Eldoria", "Whispering Woods")
5. 📜 Important laws, customs, or taboos

Return them as JSON like:
{
  "quest": "Investigate the disturbance in the Whispering Woods",
  "knownCharacters": ["Thrain Steelgrip"],
  "knownItems": ["Ring of Whispers"],
  "knownLocations": ["Eldoria", "Whispering Woods"],
  "knownLaws": ["Magic is forbidden inside the city walls"],
  "highlights": [
    { "text": "Thrain Steelgrip", "type": "character" },
    { "text": "Whispering Woods", "type": "location" },
    { "text": "Ring of Whispers", "type": "item" }
  ]
}`
        },
        {
          role: 'user',
          content: text
        }
      ]
    });

    let parsed;
    try {
      const raw = extractResponse.choices[0].message.content;
      const cleaned = raw.replace(/^```json\s*|\s*```$/g, '');
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('❌ Failed to parse OpenAI response:', extractResponse.choices[0].message.content);
      return res.status(500).json({ error: 'Failed to parse memory JSON' });
    }

    const safe = (arr) => Array.isArray(arr) ? arr : [];
    memory.quest = parsed.quest || memory.quest;
    memory.knownCharacters = Array.from(new Set([...memory.knownCharacters, ...safe(parsed.knownCharacters)]));
    memory.knownItems = Array.from(new Set([...memory.knownItems, ...safe(parsed.knownItems)]));
    memory.knownLocations = Array.from(new Set([...memory.knownLocations, ...safe(parsed.knownLocations)]));
    memory.knownLaws = Array.from(new Set([...memory.knownLaws, ...safe(parsed.knownLaws)]));
    memory.highlights = safe(parsed.highlights);

    res.json(parsed);
  } catch (err) {
    console.error('❌ Failed to extract memory:', err.message);
    res.status(500).json({ error: 'Memory extraction failed' });
  }
});

app.get('/', (req, res) => {
  res.send('RPG AI backend is running!');
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
