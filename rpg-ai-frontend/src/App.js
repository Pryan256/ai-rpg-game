

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
                {messages.map((msg, i) => {
                  if (!msg || !msg.sender || typeof msg.text !== "string") return null
                  return (
                    <div key={i} className={msg.sender}>
                      <strong>{msg.sender === "ai" ? "DM" : playerName}:</strong>{" "}
                      <span
                        dangerouslySetInnerHTML={{
                          __html: msg.sender === "ai" ? highlightText(msg.text, highlights) : msg.text,
                        }}
                      />
                    </div>
                  )
                })}
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
