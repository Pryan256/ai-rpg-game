import React, { useState } from 'react';
import './App.css';

const character = {
  name: '',
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

function App() {
  const [playerName, setPlayerName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [memory, setMemory] = useState(null);

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    if (playerName.trim()) {
      setSubmitted(true);
      character.name = playerName;

      try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: playerName, message: 'start' })
        });

        const data = await res.json();
        setMessages([{ sender: 'ai', text: data.response }]);
        setOptions(data.options || []);
        setMemory(data.memory || null);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const sendMessage = async (msg) => {
    if (!msg.trim()) return;

    setMessages((prev) => [...prev, { sender: 'player', text: msg }]);
    setInput('');
    setOptions([]);
    setLoading(true);

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName, message: msg })
      });

      const data = await res.json();
      setMessages((prev) => [...prev, { sender: 'ai', text: data.response }]);
      setOptions(data.options || []);
      setMemory(data.memory || null);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  return (
    <div className="App">
      <h1>🧙 AI Dungeon Master</h1>
      {!submitted ? (
        <form onSubmit={handleNameSubmit}>
          <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Enter your name..." />
          <button type="submit">Start</button>
        </form>
      ) : (
        <div className="main-layout">
          <div className="game-area">
            <div className="chat-box">
              {messages.map((m, i) => (
                <div key={i} className={m.sender}><strong>{m.sender === 'ai' ? 'DM' : playerName}:</strong> {m.text}</div>
              ))}
              {loading && <div className="ai">DM is thinking...</div>}
            </div>

            <div className="options">
              {options.map((o, i) => (
                <button key={i} onClick={() => sendMessage(o)}>{o}</button>
              ))}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a question or action..." />
              <button type="submit">Send</button>
            </form>
          </div>

          <div className="memory-sidebar">
            <h2>📖 World Memory</h2>
            {memory && (
              <div>
                <p><strong>🎯 Quest:</strong> {memory.quest || 'None yet'}</p>
                <p><strong>🎒 Items:</strong> {memory.knownItems.join(', ') || 'None'}</p>
                <p><strong>🧑‍🤝‍🧑 Characters:</strong> {memory.knownCharacters.join(', ') || 'None'}</p>
                <p><strong>🗺 Locations:</strong> {memory.knownLocations.join(', ') || 'None'}</p>
                <p><strong>📜 Laws:</strong> {memory.knownLaws.join(', ') || 'None'}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
