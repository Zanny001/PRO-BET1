import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import Database from "better-sqlite3";

// Initializing Database
const db = new Database("betting.db");

// Initialize DB schema based on user request (SQLite compatible)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      balance DECIMAL(12, 2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      match_id TEXT, 
      selection TEXT, -- '1', 'X', or '2'
      stake DECIMAL(10, 2) NOT NULL,
      odds DECIMAL(5, 2) NOT NULL,
      status TEXT DEFAULT 'pending', -- 'pending', 'won', 'lost'
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default user if table is empty
const userCount = db.prepare("SELECT count(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  db.prepare("INSERT INTO users (username, balance) VALUES (?, ?)").run("demo_user", 1240.50);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, { 
    cors: { origin: "*" } 
  });
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // API Route for User Info
  app.get("/api/user", (req, res) => {
    try {
      const user = db.prepare("SELECT * FROM users LIMIT 1").get();
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // Place a Bet Endpoint
  app.post('/api/place-bet', (req, res) => {
      const { stake, odds, selection, matchId } = req.body;
      const user = db.prepare("SELECT * FROM users LIMIT 1").get() as any;

      if (!user) return res.status(404).json({ error: "User not found" });

      if (stake > user.balance) {
          return res.status(400).json({ error: "Insufficient funds" });
      }

      console.log(`Processing bet: ${selection} at ${odds} odds for $${stake} on match ${matchId}`);

      const transaction = db.transaction(() => {
        // Deduct balance
        db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(stake, user.id);
        
        // Save bet
        const info = db.prepare("INSERT INTO bets (user_id, match_id, selection, stake, odds) VALUES (?, ?, ?, ?, ?)")
          .run(user.id, matchId, selection, stake, odds);
          
        return info.lastInsertRowid;
      });

      try {
        const betId = transaction();
        const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as any;
        
        res.json({ 
            success: true, 
            newBalance: updatedUser.balance,
            betId: betId 
        });
      } catch (error) {
        console.error("Bet placement error:", error);
        res.status(500).json({ error: "Transaction failed" });
      }
  });

  // WebSocket Live Odds Emulator
  // This simulates the external Odds API feed
  setInterval(() => {
      // Pick a random match to update odds for
      const matchIds = [1, 2, 3, 4, 5];
      const selectedId = matchIds[Math.floor(Math.random() * matchIds.length)];
      
      const update = {
        matchId: selectedId,
        homeOdds: (Math.random() * (2.5 - 1.1) + 1.1).toFixed(2),
        awayOdds: (Math.random() * (6.0 - 1.5) + 1.5).toFixed(2),
        drawOdds: (Math.random() > 0.5) ? (Math.random() * (4.5 - 2.8) + 2.8).toFixed(2) : undefined
      };
      
      io.emit('odds-update', update);
  }, 3000); // More frequent updates for a "live" feel

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
