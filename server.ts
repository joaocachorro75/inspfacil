import express from "express";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import mammoth from "mammoth";
import Groq from "groq-sdk";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("database.sqlite");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    name TEXT,
    whatsapp TEXT,
    role TEXT CHECK(role IN ('admin', 'technician'))
  );

  CREATE TABLE IF NOT EXISTS inspection_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    schema_json TEXT
  );

  CREATE TABLE IF NOT EXISTS inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_id INTEGER,
    technician_id INTEGER,
    status TEXT DEFAULT 'pending',
    location TEXT,
    scheduled_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(type_id) REFERENCES inspection_types(id),
    FOREIGN KEY(technician_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS inspection_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspection_id INTEGER UNIQUE,
    data_json TEXT,
    photos_json TEXT,
    analysis_text TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(inspection_id) REFERENCES inspections(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Migration: Add columns if they don't exist (for existing databases)
try {
  const tableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
  const columns = tableInfo.map(c => c.name);
  if (!columns.includes('username')) {
    db.exec("ALTER TABLE users ADD COLUMN username TEXT");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)");
  }
  if (!columns.includes('whatsapp')) {
    db.exec("ALTER TABLE users ADD COLUMN whatsapp TEXT");
  }

  const resultTableInfo = db.prepare("PRAGMA table_info(inspection_results)").all() as any[];
  const resultColumns = resultTableInfo.map(c => c.name);
  if (!resultColumns.includes('analysis_text')) {
    db.exec("ALTER TABLE inspection_results ADD COLUMN analysis_text TEXT");
  }
} catch (e) {
  console.error("Migration error:", e);
}


// Seed initial settings
const settings = [
  { key: 'evolution_url', value: process.env.EVOLUTION_API_URL || '' },
  { key: 'evolution_key', value: process.env.EVOLUTION_API_KEY || '' },
  { key: 'evolution_instance', value: process.env.EVOLUTION_INSTANCE_NAME || '' }
];

const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
settings.forEach(s => insertSetting.run(s.key, s.value));

// Seed admin if not exists or force reset password
const adminUser = db.prepare("SELECT id FROM users WHERE username = 'admin'").get() as { id: number } | undefined;
if (adminUser) {
  db.prepare("UPDATE users SET password = ?, role = 'admin' WHERE id = ?").run("admin123", adminUser.id);
  console.log("Admin password force-reset to 'admin123'");
} else {
  db.prepare("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)").run(
    "admin",
    "admin123",
    "Administrador",
    "admin"
  );
  console.log("Admin user created with password 'admin123'");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Logger global para depuração de rede no Easypanel
  app.use((req, res, next) => {
    if (req.path !== '/api/health') {
      console.log(`[${new Date().toISOString()}] 📥 ${req.method} ${req.path}`);
    }
    next();
  });

  // 1. Health Check - MUST BE FIRST for Easypanel/Docker stability
  app.get("/api/health", (req, res) => {
    console.log(`[${new Date().toISOString()}] ❤️ Health Check solicitado`);
    res.json({ 
      status: "ok", 
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV
    });
  });

  app.use(express.json({ limit: '50mb' }));

  // WhatsApp Notification Helper
  async function sendWhatsAppMessage(number: string, message: string) {
    const urlRow = db.prepare("SELECT value FROM settings WHERE key = 'evolution_url'").get() as { value: string };
    const keyRow = db.prepare("SELECT value FROM settings WHERE key = 'evolution_key'").get() as { value: string };
    const instanceRow = db.prepare("SELECT value FROM settings WHERE key = 'evolution_instance'").get() as { value: string };

    const url = urlRow?.value;
    const key = keyRow?.value;
    const instance = instanceRow?.value;

    if (!url || !key || !instance) {
      console.log("Evolution API not configured in DB. Skipping WhatsApp notification.");
      return;
    }

    try {
      const formattedNumber = number.replace(/\D/g, '');
      // Use globalThis.fetch which is safer in Node 18+
      const response = await globalThis.fetch(`${url}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key
        },
        body: JSON.stringify({
          number: formattedNumber,
          text: message
        })
      });
      console.log(`WhatsApp message sent to ${formattedNumber}, status: ${response.status}`);
    } catch (e) {
      console.error("Error sending WhatsApp message:", e);
    }
  }

  // Auth API
  app.post("/api/login", (req, res) => {
    const { identifier, password } = req.body;
    const user = db.prepare("SELECT id, username, whatsapp, name, role FROM users WHERE (username = ? OR whatsapp = ?) AND password = ?").get(identifier, identifier, password);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Credenciais inválidas" });
    }
  });

  // Admin: Manage Technicians
  app.get("/api/technicians", (req, res) => {
    const techs = db.prepare("SELECT id, username, whatsapp, name FROM users WHERE role = 'technician'").all();
    res.json(techs);
  });

  app.post("/api/technicians", (req, res) => {
    const { whatsapp, password, name } = req.body;
    try {
      db.prepare("INSERT INTO users (whatsapp, password, name, role, username) VALUES (?, ?, ?, 'technician', ?)").run(whatsapp, password, name, whatsapp);
      res.status(201).json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "WhatsApp ou Usuário já cadastrado" });
    }
  });

  app.put("/api/technicians/:id", (req, res) => {
    const { whatsapp, password, name } = req.body;
    try {
      if (password) {
        db.prepare("UPDATE users SET whatsapp = ?, password = ?, name = ?, username = ? WHERE id = ?").run(whatsapp, password, name, whatsapp, req.params.id);
      } else {
        db.prepare("UPDATE users SET whatsapp = ?, name = ?, username = ? WHERE id = ?").run(whatsapp, name, whatsapp, req.params.id);
      }
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Erro ao atualizar técnico" });
    }
  });

  app.delete("/api/technicians/:id", (req, res) => {
    try {
      // Check if tech has inspections
      const count = db.prepare("SELECT COUNT(*) as count FROM inspections WHERE technician_id = ?").get(req.params.id) as { count: number };
      if (count.count > 0) {
        return res.status(400).json({ error: "Não é possível excluir técnico com inspeções vinculadas" });
      }
      db.prepare("DELETE FROM users WHERE id = ? AND role = 'technician'").run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao excluir técnico" });
    }
  });

  // Admin: Extract text from Word file
  app.post("/api/extract-text", async (req, res) => {
    const { fileData } = req.body;
    try {
      const buffer = Buffer.from(fileData.split(',')[1], 'base64');
      const result = await mammoth.extractRawText({ buffer });
      res.json({ text: result.value });
    } catch (e) {
      res.status(500).json({ error: "Erro ao extrair texto do arquivo" });
    }
  });

  // AI: Generate form schema from text/file
  app.post("/api/ai/generate-schema", async (req, res) => {
    const { content, fileData, fileType } = req.body;
    
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY não configurada no servidor" });
    }

    const groq = new Groq({ apiKey });
    
    try {
      const promptContent = `Analise o seguinte conteúdo de um formulário de inspeção e gere um esquema JSON para um formulário dinâmico. 
      O esquema deve ser um array de objetos, onde cada objeto tem: "label" (string), "type" (string: 'text', 'number', 'boolean', 'select'), "options" (array de strings, apenas se type for 'select'), "required" (boolean).
      
      IMPORTANTE: Se o formulário tiver perguntas de Sim/Não/NA, use type: 'boolean'. Se for múltipla escolha, use type: 'select'.
      Responda APENAS o JSON.`;

      let messages: any[] = [{ role: 'user', content: [{ type: 'text', text: promptContent }] }];

      if (fileData) {
        // Para Word, o texto já foi extraído pelo endpoint /api/extract-text
        messages[0].content.push({ type: 'text', text: `Conteúdo do arquivo: ${content}` });
      } else if (content) {
        messages[0].content.push({ type: 'text', text: `Conteúdo: ${content}` });
      }

      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");
      const schema = Array.isArray(result) ? result : (result.schema || result.fields || []);
      
      res.json({ schema });
    } catch (e: any) {
      console.error("AI Error:", e);
      res.status(500).json({ error: "Erro ao gerar formulário via IA: " + (e.message || "Erro desconhecido") });
    }
  });

  // AI: Analyze inspection results with photos
  app.post("/api/ai/analyze-inspection/:id", async (req, res) => {
    const inspectionId = req.params.id;
    const { typeName, data, photos } = req.body;
    
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY não configurada no servidor" });
    }

    const groq = new Groq({ apiKey });
    
    try {
      const prompt = `Você é um especialista em segurança do trabalho. Analise os seguintes dados de uma inspeção de "${typeName}" e forneça um parecer técnico resumido, destacando riscos e recomendações.
      Dados: ${JSON.stringify(data)}`;

      const content: any[] = [{ type: 'text', text: prompt }];
      
      // Add up to 3 photos for analysis
      if (photos && photos.length > 0) {
        photos.slice(0, 3).forEach((photo: string) => {
          content.push({
            type: 'image_url',
            image_url: { url: photo }
          });
        });
      }

      const response = await groq.chat.completions.create({
        model: "llava-v1.5-7b-4096-preview",
        messages: [{ role: 'user', content }]
      });

      const analysis = response.choices[0]?.message?.content || "";
      
      // Save analysis to database
      db.prepare("UPDATE inspection_results SET analysis_text = ? WHERE inspection_id = ?").run(analysis, inspectionId);
      
      res.json({ analysis });
    } catch (e: any) {
      console.error("AI Analysis Error:", e);
      res.status(500).json({ error: "Erro ao gerar análise via IA: " + (e.message || "Erro desconhecido") });
    }
  });

  // Admin: Create Inspection Type (Schema received from frontend)
  app.post("/api/inspection-types", (req, res) => {
    const { name, schema } = req.body;
    try {
      const result = db.prepare("INSERT INTO inspection_types (name, schema_json) VALUES (?, ?)").run(name, JSON.stringify(schema));
      res.json({ id: result.lastInsertRowid, name, schema });
    } catch (e) {
      res.status(500).json({ error: "Erro ao salvar tipo de inspeção" });
    }
  });

  app.put("/api/inspection-types/:id", (req, res) => {
    const { name, schema } = req.body;
    try {
      db.prepare("UPDATE inspection_types SET name = ?, schema_json = ? WHERE id = ?").run(name, JSON.stringify(schema), req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao atualizar tipo de inspeção" });
    }
  });

  app.delete("/api/inspection-types/:id", (req, res) => {
    try {
      const count = db.prepare("SELECT COUNT(*) as count FROM inspections WHERE type_id = ?").get(req.params.id) as { count: number };
      if (count.count > 0) {
        return res.status(400).json({ error: "Não é possível excluir tipo com inspeções vinculadas" });
      }
      db.prepare("DELETE FROM inspection_types WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao excluir tipo de inspeção" });
    }
  });

  app.get("/api/inspection-types", (req, res) => {
    const types = db.prepare("SELECT * FROM inspection_types").all();
    res.json(types.map(t => ({ ...t, schema: JSON.parse(t.schema_json) })));
  });

  // Admin: Assign Inspection
  app.post("/api/inspections", async (req, res) => {
    const { type_id, technician_id, location, scheduled_date } = req.body;
    db.prepare("INSERT INTO inspections (type_id, technician_id, location, scheduled_date) VALUES (?, ?, ?, ?)").run(
      type_id, technician_id, location, scheduled_date
    );

    // Notify Technician via WhatsApp
    const tech = db.prepare("SELECT whatsapp, name FROM users WHERE id = ?").get(technician_id);
    const type = db.prepare("SELECT name FROM inspection_types WHERE id = ?").get(type_id);
    if (tech && tech.whatsapp) {
      const message = `Olá ${tech.name}! Uma nova inspeção de "${type.name}" foi agendada para você em ${location} no dia ${scheduled_date}. Acesse o sistema para preencher o formulário.`;
      await sendWhatsAppMessage(tech.whatsapp, message);
    }

    res.status(201).json({ success: true });
  });

  app.put("/api/inspections/:id", (req, res) => {
    const { type_id, technician_id, location, scheduled_date, status } = req.body;
    try {
      db.prepare("UPDATE inspections SET type_id = ?, technician_id = ?, location = ?, scheduled_date = ?, status = ? WHERE id = ?").run(
        type_id, technician_id, location, scheduled_date, status, req.params.id
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao atualizar inspeção" });
    }
  });

  app.delete("/api/inspections/:id", (req, res) => {
    try {
      const transaction = db.transaction(() => {
        db.prepare("DELETE FROM inspection_results WHERE inspection_id = ?").run(req.params.id);
        db.prepare("DELETE FROM inspections WHERE id = ?").run(req.params.id);
      });
      transaction();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao excluir inspeção" });
    }
  });

  app.get("/api/inspections/admin", (req, res) => {
    const inspections = db.prepare(`
      SELECT i.*, it.name as type_name, u.name as technician_name, ir.submitted_at
      FROM inspections i
      JOIN inspection_types it ON i.type_id = it.id
      JOIN users u ON i.technician_id = u.id
      LEFT JOIN inspection_results ir ON i.id = ir.inspection_id
      ORDER BY i.created_at DESC
    `).all();
    res.json(inspections);
  });

  // Technician: My Inspections
  app.get("/api/inspections/technician/:id", (req, res) => {
    const inspections = db.prepare(`
      SELECT i.*, it.name as type_name, it.schema_json
      FROM inspections i
      JOIN inspection_types it ON i.type_id = it.id
      WHERE i.technician_id = ? AND i.status = 'pending'
    `).all(req.params.id);
    res.json(inspections.map(i => ({ ...i, schema: JSON.parse(i.schema_json) })));
  });

  // Technician: Submit Result
  app.post("/api/inspections/:id/submit", (req, res) => {
    const { data, photos } = req.body;
    const inspectionId = req.params.id;
    
    const transaction = db.transaction(() => {
      db.prepare("INSERT INTO inspection_results (inspection_id, data_json, photos_json) VALUES (?, ?, ?)").run(
        inspectionId, JSON.stringify(data), JSON.stringify(photos)
      );
      db.prepare("UPDATE inspections SET status = 'completed' WHERE id = ?").run(inspectionId);
    });
    
    try {
      transaction();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao salvar inspeção" });
    }
  });

  // Admin: View Report
  app.get("/api/inspections/:id/report", (req, res) => {
    const report = db.prepare(`
      SELECT i.*, it.name as type_name, u.name as technician_name, ir.data_json, ir.photos_json, ir.analysis_text, ir.submitted_at
      FROM inspections i
      JOIN inspection_types it ON i.type_id = it.id
      JOIN users u ON i.technician_id = u.id
      JOIN inspection_results ir ON i.id = ir.inspection_id
      WHERE i.id = ?
    `).get(req.params.id);
    
    if (report) {
      res.json({
        ...report,
        data: JSON.parse(report.data_json),
        photos: JSON.parse(report.photos_json),
        analysis: report.analysis_text
      });
    } else {
      res.status(404).json({ error: "Relatório não encontrado" });
    }
  });

  // Admin: Save AI Analysis
  app.post("/api/inspections/:id/analysis", (req, res) => {
    const { analysis } = req.body;
    const inspectionId = req.params.id;
    try {
      db.prepare("UPDATE inspection_results SET analysis_text = ? WHERE inspection_id = ?").run(analysis, inspectionId);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao salvar análise" });
    }
  });

  // Admin: Dashboard Stats
  app.get("/api/stats", (req, res) => {
    const totalInspections = db.prepare("SELECT COUNT(*) as count FROM inspections").get() as { count: number };
    const completedInspections = db.prepare("SELECT COUNT(*) as count FROM inspections WHERE status = 'completed'").get() as { count: number };
    const pendingInspections = db.prepare("SELECT COUNT(*) as count FROM inspections WHERE status = 'pending'").get() as { count: number };
    
    const inspectionsByTech = db.prepare(`
      SELECT u.name, COUNT(i.id) as count
      FROM users u
      LEFT JOIN inspections i ON u.id = i.technician_id
      WHERE u.role = 'technician'
      GROUP BY u.id
    `).all();

    const inspectionsByType = db.prepare(`
      SELECT it.name, COUNT(i.id) as count
      FROM inspection_types it
      LEFT JOIN inspections i ON it.id = i.type_id
      GROUP BY it.id
    `).all();

    // Risk analysis: Count "Não" answers in results
    const results = db.prepare("SELECT data_json FROM inspection_results").all() as { data_json: string }[];
    let riskCount = 0;
    results.forEach(r => {
      const data = JSON.parse(r.data_json);
      Object.values(data).forEach(val => {
        if (val === 'Não' || val === false) riskCount++;
      });
    });

    res.json({
      total: totalInspections.count,
      completed: completedInspections.count,
      pending: pendingInspections.count,
      byTech: inspectionsByTech,
      byType: inspectionsByType,
      risksFound: riskCount
    });
  });

  // Admin: Settings
  app.get("/api/settings", (req, res) => {
    const rows = db.prepare("SELECT * FROM settings").all();
    const settingsObj = (rows as { key: string, value: string }[]).reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {} as Record<string, string>);
    res.json(settingsObj);
  });

  app.post("/api/settings", (req, res) => {
    const settings = req.body;
    const update = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    
    const transaction = db.transaction((data) => {
      for (const [key, value] of Object.entries(data)) {
        update.run(key, value);
      }
    });

    try {
      transaction(settings);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao salvar configurações" });
    }
  });

  // Global Error Handler to ensure JSON response
  app.use((err: any, req: any, res: any, next: any) => {
    console.error(err.stack);
    res.status(500).json({ error: "Erro interno do servidor", message: err.message });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Inspetor EPI rodando em http://0.0.0.0:${PORT}`);
    console.log(`📢 Health Check disponível em http://0.0.0.0:${PORT}/api/health`);
  });

  // Handle Graceful Shutdown
  process.on('SIGTERM', () => {
    console.log('⚠️ SIGTERM recebido do Easypanel/Docker. Encerrando servidor...');
    server.close(() => {
      console.log('✅ Servidor encerrado com sucesso.');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('⚠️ SIGINT recebido. Encerrando...');
    server.close(() => process.exit(0));
  });

  // Global Exception Handlers
  process.on('uncaughtException', (err) => {
    console.error('❌ ERRO NÃO TRATADO:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ REJEIÇÃO NÃO TRATADA em:', promise, 'razão:', reason);
  });
}

startServer();
