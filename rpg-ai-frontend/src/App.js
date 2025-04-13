// App.js
"use client"

import { useState, useRef } from "react"
import "./App.css"
import { v4 as uuidv4 } from "uuid"

const character = {
  name: "",
  race: "Elf",
  class: "Wizard",
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
  inventory: ["Spellbook", "Staff", "Potion of Healing"],
}

function App() {
  const [playerName, setPlayerName] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [input, setInput] = useState("")
  const [history, setHistory] = useState([])
  const [currentTurn, setCurrentTurn] = useState([])
  const [options, setOptions] = useState([])
  const [showActions, setShowActions] = useState(false)
  const [rollPrompt, setRollPrompt] = useState(null)
  const [lastRollContext, setLastRollContext] = useState("")
  const [lastPlayerQuestion, setLastPlayerQuestion] = useState("")
  const [memory, setMemory] = useState({
    quest: "",
    knownCharacters: [],
    knownItems: [],
    knownLocations: [],
    knownLaws: [],
  })
  const [highlights, setHighlights] = useState([])

  const [sessionId] = useState(() => {
    const stored = localStorage.getItem("sessionId")
    if (stored) return stored
    const newId = uuidv4()
    localStorage.setItem("sessionId", newId)
    return newId
  })

  const chatRef = useRef()

  const scrollToBottom = () => {
    const el = chatRef.current
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
  }

  const scrollToTop = () => {
    const el = chatRef.current
    if (el) {
      el.scrollTop = 0
    }
  }

  const statModifier = (statScore) => Math.floor((statScore - 10) / 2)

  const clearMemory = async () => {
    try {
      await fetch(`${process.env.REACT_APP_API_URL}/clear-memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
      setMemory({ quest: "", knownCharacters: [], knownItems: [], knownLocations: [], knownLaws: [] })
      setHighlights([])
    } catch (err) {
      console.error("Failed to clear memory:", err)
    }
  }

  const detectRollRequest = (text) => {
    const match = text.match(/make (an?|a)?\s*(\w+)\s+check(?:\s*DC\s*(\d+))?/i)
    if (match) {
      const ability = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase()
      const dc = match[3] ? Number.parseInt(match[3]) : null
      const sentenceMatch = text.match(/.*?make.*?check.*?[.?!]/i)
      setLastRollContext(sentenceMatch ? sentenceMatch[0] : "")
      setRollPrompt({ ability, dc })
    } else {
      setRollPrompt(null)
      setLastRollContext("")
    }
  }

  const highlightText = (text, highlights) => {
    if (!Array.isArray(highlights)) return text
    let highlighted = text
    highlights.forEach(({ text: phrase, type }) => {
      if (!phrase || typeof phrase !== "string") return
      const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const regex = new RegExp('\\b(' + escapedPhrase + ')\\b', 'gi')
      highlighted = highlighted.replace(regex, '<span class="highlight-' + type + '">$1</span>')

    })
    return highlighted
  }

  const extractMemory = async (text) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/extract-memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sessionId }),
      })
      const extracted = await res.json()
      const safe = (val) => (Array.isArray(val) ? val : [])
      setMemory((prev) => ({
        quest: extracted.quest || prev.quest,
        knownCharacters: Array.from(new Set([...prev.knownCharacters, ...safe(extracted.knownCharacters)])),
        knownItems: Array.from(new Set([...prev.knownItems, ...safe(extracted.knownItems)])),
        knownLocations: Array.from(new Set([...prev.knownLocations, ...safe(extracted.knownLocations)])),
        knownLaws: Array.from(new Set([...prev.knownLaws, ...safe(extracted.knownLaws)])),
      }))
      setHighlights(safe(extracted.highlights))
    } catch (err) {
      console.error("Memory extraction failed:", err)
    }
  }

  const streamMessage = async (text, onDone = () => {}) => {
    const words = text.split(" ")
    let accumulated = ""
    await new Promise((resolve) => setTimeout(resolve, 50))

    setCurrentTurn((prev) => [...prev, { sender: "ai", text: "" }])

    words.forEach((word, index) => {
      setTimeout(() => {
        accumulated += word + " "
        setCurrentTurn((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.sender === "ai") last.text = accumulated
          return updated
        })
        if (index === words.length - 1) {
          onDone()
          scrollToBottom()
        }
      }, index * 40)
    })
  }

  const sendMessage = async (msg = input, silent = false) => {
    if (!msg.trim()) return
    setInput("")
    setOptions([])
    setRollPrompt(null)
    setLastPlayerQuestion(msg)
    setHistory((prev) => [...prev, ...currentTurn])
    setCurrentTurn([{ sender: "player", text: msg }])

    scrollToTop()

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playerName, message: msg, sessionId }),
      })
      const data = await res.json()
      const storyPart = data.response
      const choices = data.options || []
      detectRollRequest(storyPart)
      extractMemory(storyPart)
      await streamMessage(storyPart, () => {
        setOptions(choices)
        setShowActions(false)
      })
    } catch (err) {
      console.error("Error:", err)
      setCurrentTurn((prev) => [...prev, { sender: "ai", text: "⚠️ Something went wrong talking to the Dungeon Master." }])
    }
  }

  const handleNameSubmit = async (e) => {
    e.preventDefault()
    if (!playerName.trim()) return
    setSubmitted(true)
    character.name = playerName
    sendMessage("start", true)
  }

  const handleOptionClick = (option) => {
    setInput(option)
    sendMessage(option)
  }

  const handleRollCheck = () => {
    if (!rollPrompt) return
    const statMap = {
      Strength: "STR",
      Dexterity: "DEX",
      Constitution: "CON",
      Intelligence: "INT",
      Wisdom: "WIS",
      Charisma: "CHA",
      Arcana: "INT",
      Nature: "INT",
      Perception: "WIS",
      Insight: "WIS",
      History: "INT",
      Investigation: "INT",
    }
    const statKey = statMap[rollPrompt.ability] || "INT"
    const roll = Math.floor(Math.random() * 20) + 1
    const mod = statModifier(character.stats[statKey])
    const total = roll + mod
    const rollResult = `🎲 ${rollPrompt.ability} check${rollPrompt.dc ? ` (DC ${rollPrompt.dc})` : ""}: Rolled ${roll} + ${mod} = ${total}`
    const playerMsg = `I rolled a ${total} on my ${rollPrompt.ability} check.\nThis was in response to my question: "${lastPlayerQuestion}" and the DM's prompt: "${lastRollContext}"`
    setCurrentTurn((prev) => [...prev, { sender: "player", text: rollResult }])
    sendMessage(playerMsg, true)
    setRollPrompt(null)
    setLastRollContext("")
  }

  return (
    <div className="App">
      <header className="top-nav">
        <div className="nav-content">
          <span className="logo">🧙 AI Dungeon Master</span>
        </div>
      </header>

      {!submitted ? (
        <form onSubmit={handleNameSubmit} className="name-form">
          <input
            type="text"
            placeholder="Enter your character name..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
          <button type="submit">Start Adventure</button>
        </form>
      ) : (
        <div className="main-grid">
          <div className="column character-sheet">
            <h2>{playerName}</h2>
            <p><strong>Race:</strong> {character.race}</p>
            <p><strong>Class:</strong> {character.class}</p>
            <p><strong>Level:</strong> {character.level}</p>
            <p><strong>HP:</strong> {character.hp}</p>
            <h3>Stats</h3>
            <ul>
              {Object.entries(character.stats).map(([stat, value]) => (
                <li key={stat}>{stat}: {value}</li>
              ))}
            </ul>
            <h3>Inventory</h3>
            <ul>
              {character.inventory.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="column game-area">
            <div className="chat-box" ref={chatRef}>
              <div className="chat-box-inner">
                {history.map((msg, i) => (
                  <div key={i} className={msg.sender}>
                    <strong>{msg.sender === "ai" ? "DM" : playerName}:</strong>{" "}
                    <span dangerouslySetInnerHTML={{ __html: msg.sender === "ai" ? highlightText(msg.text, highlights) : msg.text }} />
                  </div>
                ))}
                {currentTurn.map((msg, i) => (
                  <div key={`c-${i}`} className={msg.sender}>
                    <strong>{msg.sender === "ai" ? "DM" : playerName}:</strong>{" "}
                    <span dangerouslySetInnerHTML={{ __html: msg.sender === "ai" ? highlightText(msg.text, highlights) : msg.text }} />
                  </div>
                ))}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                sendMessage(input)
              }}
              className="floating-input"
            >
              <input
                type="text"
                placeholder="Ask a question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button type="button" onClick={() => setShowActions((prev) => !prev)}>
                ⚔️ Actions
              </button>
              {showActions && (
                <div className="popup-actions">
                  {options.map((option, i) => (
                    <button key={i} onClick={() => handleOptionClick(option)}>
                      {option}
                    </button>
                  ))}
                  {rollPrompt && (
                    <>
                      {lastRollContext && (
                        <p className="roll-context" style={{ marginTop: "0.5rem", fontStyle: "italic" }}>
                          🧠 Rolling for: <em>{lastRollContext}</em>
                        </p>
                      )}
                      <button onClick={handleRollCheck}>
                        🎲 Roll {rollPrompt.ability} Check{rollPrompt.dc ? ` (DC ${rollPrompt.dc})` : ""}
                      </button>
                    </>
                  )}
                  <button onClick={clearMemory}>🧼 Clear Memory</button>
                </div>
              )}
            </form>
          </div>

          <div className="column memory-sidebar">
            <h2>📖 World Memory</h2>
            <p><strong>🎯 Quest:</strong> {memory.quest || "None yet"}</p>
            <p><strong>🎒 Items:</strong> {memory.knownItems.join(", ") || "None"}</p>
            <p><strong>🧑‍🤝‍🧑 Characters:</strong> {memory.knownCharacters.join(", ") || "None"}</p>
            <p><strong>🗺 Locations:</strong> {memory.knownLocations.join(", ") || "None"}</p>
            <p><strong>📜 Laws:</strong> {memory.knownLaws.join(", ") || "None"}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
