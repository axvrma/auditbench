import express from 'express';
import cors from 'cors';
import { db, generateId } from './db.js';
import { runLighthouseAudit, stopAuditBrowser, type AuthConfig } from './lighthouse.js';
import { screenshotsDirectory } from './paths.js';

// Database record types
interface ModuleRecord {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: number;
  created_at: string;
}

interface UrlRecord {
  id: string;
  module_id: string;
  url: string;
  name: string | null;
  is_active: number;
  auth_url: string | null;
  auth_username: string | null;
  auth_password: string | null;
  auth_username_selector: string | null;
  auth_password_selector: string | null;
  auth_submit_selector: string | null;
  credential_id: string | null;
  created_at: string;
}

interface AuditRecord {
  id: string;
  url_id: string;
  status: string;
  performance_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  seo_score: number | null;
  pwa_score: number | null;
  screenshot_path: string | null;
  full_report: string | null;
  error_message: string | null;
  created_at: string;
}

interface CredentialRecord {
  id: string;
  name: string;
  auth_url: string | null;
  username: string;
  password: string;
  username_selector: string | null;
  password_selector: string | null;
  submit_selector: string | null;
  created_at: string;
}
const app = express();
const desktopToken = process.env.LIGHTHOUSE_DESKTOP_TOKEN;
let shuttingDown = false;

if (desktopToken) {
  db.prepare("UPDATE audits SET status = 'failed', error_message = ? WHERE status = 'running'")
    .run('The app closed before this audit finished.');

  app.use((req, res, next) => {
    if (req.get('X-Lighthouse-Session') !== desktopToken) {
      res.sendStatus(403);
      return;
    }

    res.set('Cache-Control', 'no-store');
    res.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
} else {
  app.use(cors());
}

app.use(express.json());

// Serve screenshots
app.use('/screenshots', express.static(screenshotsDirectory));

// ============ MODULES ============

app.get('/api/modules', (_req, res) => {
  const modules = db.prepare('SELECT * FROM modules ORDER BY created_at DESC').all() as ModuleRecord[];
  res.json(modules.map(m => ({ ...m, is_active: Boolean(m.is_active) })));
});

app.post('/api/modules', (req, res) => {
  const { name, description, color } = req.body;
  const id = generateId();
  
  db.prepare(
    'INSERT INTO modules (id, name, description, color) VALUES (?, ?, ?, ?)'
  ).run(id, name, description || null, color || '#3b82f6');
  
  const module = db.prepare('SELECT * FROM modules WHERE id = ?').get(id) as ModuleRecord;
  res.json({ ...module, is_active: Boolean(module.is_active) });
});

app.patch('/api/modules/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, color, is_active } = req.body;
  
  const updates: string[] = [];
  const values: unknown[] = [];
  
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (color !== undefined) { updates.push('color = ?'); values.push(color); }
  if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0); }
  
  if (updates.length > 0) {
    values.push(id);
    db.prepare(`UPDATE modules SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  
  const module = db.prepare('SELECT * FROM modules WHERE id = ?').get(id) as ModuleRecord;
  res.json({ ...module, is_active: Boolean(module.is_active) });
});

app.delete('/api/modules/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM modules WHERE id = ?').run(id);
  res.json({ success: true });
});

// ============ CREDENTIALS ============

app.get('/api/credentials', (_req, res) => {
  const credentials = db.prepare('SELECT * FROM credentials ORDER BY name ASC').all();
  res.json(credentials);
});

app.post('/api/credentials', (req, res) => {
  const { name, auth_url, username, password, username_selector, password_selector, submit_selector } = req.body;
  const id = generateId();
  
  try {
    db.prepare(
      `INSERT INTO credentials (id, name, auth_url, username, password, username_selector, password_selector, submit_selector) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, auth_url || null, username, password, 
          username_selector || null, password_selector || null, submit_selector || null);
    
    const credential = db.prepare('SELECT * FROM credentials WHERE id = ?').get(id);
    res.json(credential);
  } catch (error) {
    if ((error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'A credential with this name already exists' });
    }
    throw error;
  }
});

app.patch('/api/credentials/:id', (req, res) => {
  const { id } = req.params;
  const { name, auth_url, username, password, username_selector, password_selector, submit_selector } = req.body;
  
  const updates: string[] = [];
  const values: unknown[] = [];
  
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (auth_url !== undefined) { updates.push('auth_url = ?'); values.push(auth_url || null); }
  if (username !== undefined) { updates.push('username = ?'); values.push(username); }
  if (password !== undefined) { updates.push('password = ?'); values.push(password); }
  if (username_selector !== undefined) { updates.push('username_selector = ?'); values.push(username_selector || null); }
  if (password_selector !== undefined) { updates.push('password_selector = ?'); values.push(password_selector || null); }
  if (submit_selector !== undefined) { updates.push('submit_selector = ?'); values.push(submit_selector || null); }
  
  if (updates.length > 0) {
    values.push(id);
    db.prepare(`UPDATE credentials SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  
  const credential = db.prepare('SELECT * FROM credentials WHERE id = ?').get(id) as CredentialRecord;
  res.json(credential);
});

app.delete('/api/credentials/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM credentials WHERE id = ?').run(id);
  res.json({ success: true });
});

// ============ URLS ============

app.get('/api/urls', (_req, res) => {
  const urls = db.prepare('SELECT * FROM urls ORDER BY created_at DESC').all() as UrlRecord[];
  res.json(urls.map(u => ({ ...u, is_active: Boolean(u.is_active) })));
});

app.post('/api/urls', (req, res) => {
  const { url, module_id, name, credential_id, auth_url, auth_username, auth_password, auth_username_selector, auth_password_selector, auth_submit_selector } = req.body;
  const id = generateId();
  
  db.prepare(
    `INSERT INTO urls (id, module_id, url, name, credential_id, auth_url, auth_username, auth_password, auth_username_selector, auth_password_selector, auth_submit_selector) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, module_id, url, name || null, credential_id || null, auth_url || null, auth_username || null, auth_password || null, 
        auth_username_selector || null, auth_password_selector || null, auth_submit_selector || null);
  
  const urlRecord = db.prepare('SELECT * FROM urls WHERE id = ?').get(id) as UrlRecord;
  res.json({ ...urlRecord, is_active: Boolean(urlRecord.is_active) });
});

app.patch('/api/urls/:id', (req, res) => {
  const { id } = req.params;
  const { name, is_active, credential_id, auth_url, auth_username, auth_password, auth_username_selector, auth_password_selector, auth_submit_selector } = req.body;
  
  const updates: string[] = [];
  const values: unknown[] = [];
  
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0); }
  if (credential_id !== undefined) { updates.push('credential_id = ?'); values.push(credential_id || null); }
  if (auth_url !== undefined) { updates.push('auth_url = ?'); values.push(auth_url || null); }
  if (auth_username !== undefined) { updates.push('auth_username = ?'); values.push(auth_username || null); }
  if (auth_password !== undefined) { updates.push('auth_password = ?'); values.push(auth_password || null); }
  if (auth_username_selector !== undefined) { updates.push('auth_username_selector = ?'); values.push(auth_username_selector || null); }
  if (auth_password_selector !== undefined) { updates.push('auth_password_selector = ?'); values.push(auth_password_selector || null); }
  if (auth_submit_selector !== undefined) { updates.push('auth_submit_selector = ?'); values.push(auth_submit_selector || null); }
  
  if (updates.length > 0) {
    values.push(id);
    db.prepare(`UPDATE urls SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  
  const urlRecord = db.prepare('SELECT * FROM urls WHERE id = ?').get(id) as UrlRecord;
  res.json({ ...urlRecord, is_active: Boolean(urlRecord.is_active) });
});

app.delete('/api/urls/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM urls WHERE id = ?').run(id);
  res.json({ success: true });
});

// ============ AUDITS ============

app.get('/api/audits', (req, res) => {
  const { url_id } = req.query;
  
  let audits: AuditRecord[];
  if (url_id) {
    audits = db.prepare(
      'SELECT * FROM audits WHERE url_id = ? ORDER BY created_at DESC LIMIT 100'
    ).all(url_id) as AuditRecord[];
  } else {
    audits = db.prepare(
      'SELECT * FROM audits ORDER BY created_at DESC LIMIT 100'
    ).all() as AuditRecord[];
  }
  
  res.json(audits);
});

interface AuditWithUrl extends AuditRecord {
  url: string;
  url_name: string | null;
  module_id: string;
}

app.get('/api/audits/latest', (_req, res) => {
  const audits = db.prepare(`
    SELECT a.*, u.url, u.name as url_name, u.module_id
    FROM audits a
    JOIN urls u ON a.url_id = u.id
    WHERE a.status = 'completed'
    ORDER BY a.created_at DESC
    LIMIT 50
  `).all() as AuditWithUrl[];
  
  res.json(audits.map(a => ({
    ...a,
    url: {
      id: a.url_id,
      url: a.url,
      name: a.url_name,
      module_id: a.module_id,
    }
  })));
});

app.get('/api/audits/:urlId/history', (req, res) => {
  const { urlId } = req.params;
  const audits = db.prepare(`
    SELECT * FROM audits 
    WHERE url_id = ? AND status = 'completed'
    ORDER BY created_at ASC
    LIMIT 30
  `).all(urlId) as AuditRecord[];
  
  res.json(audits);
});

interface SuggestionRecord {
  id: string;
  audit_id: string;
  category: string;
  audit_ref: string;
  title: string;
  description: string;
  score: number | null;
  savings_ms: number;
  savings_bytes: number;
  created_at: string;
}

app.get('/api/suggestions/:auditId', (req, res) => {
  const { auditId } = req.params;
  const suggestions = db.prepare(
    'SELECT * FROM suggestions WHERE audit_id = ? ORDER BY savings_ms DESC'
  ).all(auditId) as SuggestionRecord[];
  
  res.json(suggestions);
});

// Get full Lighthouse report for an audit
app.get('/api/audits/:auditId/report', (req, res) => {
  const { auditId } = req.params;
  const audit = db.prepare('SELECT full_report FROM audits WHERE id = ?').get(auditId) as { full_report: string } | undefined;
  
  if (!audit) {
    return res.status(404).json({ error: 'Audit not found' });
  }
  
  if (!audit.full_report) {
    return res.status(404).json({ error: 'Full report not available for this audit' });
  }
  
  try {
    const report = JSON.parse(audit.full_report);
    res.json(report);
  } catch {
    res.status(500).json({ error: 'Failed to parse report' });
  }
});

// ============ RUN AUDIT ============

interface UrlProgress {
  id: string;
  url: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  scores?: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
    pwa: number | null;
  };
  error?: string;
}

let auditProgress = {
  inProgress: false,
  total: 0,
  completed: 0,
  currentUrl: '',
  urls: [] as UrlProgress[],
};

app.post('/api/audit/run', async (req, res) => {
  const { url_id, module_id } = req.body;
  
  if (shuttingDown) {
    return res.sendStatus(503);
  }
  if (auditProgress.inProgress) {
    return res.status(409).json({ error: 'An audit is already in progress' });
  }
  
  // Get URL(s) to audit - only active URLs in active modules
  let urls: UrlRecord[];
  if (url_id) {
    // Single URL - check both URL and its module are active
    urls = db.prepare(`
      SELECT u.* FROM urls u
      LEFT JOIN modules m ON u.module_id = m.id
      WHERE u.id = ? AND u.is_active = 1 AND (m.is_active = 1 OR m.id IS NULL)
    `).all(url_id) as UrlRecord[];
  } else if (module_id) {
    // All URLs in a module - check module is active
    const module = db.prepare('SELECT is_active FROM modules WHERE id = ?').get(module_id) as { is_active: number } | undefined;
    if (!module || !module.is_active) {
      return res.status(400).json({ error: 'Module is disabled' });
    }
    urls = db.prepare('SELECT * FROM urls WHERE module_id = ? AND is_active = 1').all(module_id) as UrlRecord[];
  } else {
    // All URLs - only from active modules
    urls = db.prepare(`
      SELECT u.* FROM urls u
      LEFT JOIN modules m ON u.module_id = m.id
      WHERE u.is_active = 1 AND (m.is_active = 1 OR m.id IS NULL)
    `).all() as UrlRecord[];
  }
  
  if (urls.length === 0) {
    return res.status(404).json({ error: 'No active URLs found' });
  }
  
  // Initialize progress tracking with per-URL status
  auditProgress = {
    inProgress: true,
    total: urls.length,
    completed: 0,
    currentUrl: '',
    urls: urls.map(u => ({
      id: u.id,
      url: u.url,
      name: u.name || u.url,
      status: 'pending' as const,
    })),
  };
  
  // Return immediately, process in background
  res.json({ 
    message: `Starting audit for ${urls.length} URL(s)`,
    urls: urls.map(u => u.url),
    total: urls.length,
  });
  
  // Process audits
  for (let i = 0; i < urls.length && !shuttingDown; i++) {
    const urlRecord = urls[i];
    
    // Update progress with current URL immediately
    auditProgress.currentUrl = urlRecord.name || urlRecord.url;
    auditProgress.urls[i].status = 'running';
    console.log(`\nAuditing (${auditProgress.completed + 1}/${auditProgress.total}): ${auditProgress.currentUrl}`);
    
    const auditId = generateId();
    
    // Create pending audit
    db.prepare(`
      INSERT INTO audits (id, url_id, status) VALUES (?, ?, 'running')
    `).run(auditId, urlRecord.id);
    
    try {
      
      // Prepare auth config - check credentials table first, then URL-specific creds
      let authConfig: AuthConfig | undefined;
      
      if (urlRecord.credential_id) {
        // Use saved credentials
        const cred = db.prepare('SELECT * FROM credentials WHERE id = ?').get(urlRecord.credential_id) as {
          auth_url: string | null;
          username: string;
          password: string;
          username_selector: string | null;
          password_selector: string | null;
          submit_selector: string | null;
        } | undefined;
        
        if (cred) {
          authConfig = {
            authUrl: cred.auth_url ?? urlRecord.auth_url ?? undefined,
            username: cred.username,
            password: cred.password,
            usernameSelector: cred.username_selector ?? undefined,
            passwordSelector: cred.password_selector ?? undefined,
            submitSelector: cred.submit_selector ?? undefined,
          };
          console.log('Using saved credentials');
        }
      } else if (urlRecord.auth_username) {
        // Use URL-specific credentials
        authConfig = {
          authUrl: urlRecord.auth_url ?? undefined,
          username: urlRecord.auth_username,
          password: urlRecord.auth_password ?? undefined,
          usernameSelector: urlRecord.auth_username_selector ?? undefined,
          passwordSelector: urlRecord.auth_password_selector ?? undefined,
          submitSelector: urlRecord.auth_submit_selector ?? undefined,
        };
        console.log('Using URL-specific credentials');
      }
      
      const result = await runLighthouseAudit(urlRecord.url, auditId, authConfig);
      
      // Update audit with results
      db.prepare(`
        UPDATE audits SET
          performance_score = ?,
          accessibility_score = ?,
          best_practices_score = ?,
          seo_score = ?,
          pwa_score = ?,
          screenshot_path = ?,
          full_report = ?,
          status = 'completed'
        WHERE id = ?
      `).run(
        result.scores.performance,
        result.scores.accessibility,
        result.scores.bestPractices,
        result.scores.seo,
        result.scores.pwa,
        result.screenshotPath,
        JSON.stringify(result.fullReport),
        auditId
      );
      
      // Insert suggestions
      const insertSuggestion = db.prepare(`
        INSERT INTO suggestions (id, audit_id, category, audit_ref, title, description, score, savings_ms, savings_bytes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const s of result.suggestions) {
        insertSuggestion.run(
          generateId(),
          auditId,
          s.category,
          s.auditRef,
          s.title,
          s.description,
          s.score,
          Math.round(s.savingsMs),
          Math.round(s.savingsBytes)
        );
      }
      
      // Update per-URL progress with scores
      auditProgress.urls[i].status = 'completed';
      auditProgress.urls[i].scores = {
        performance: result.scores.performance,
        accessibility: result.scores.accessibility,
        bestPractices: result.scores.bestPractices,
        seo: result.scores.seo,
        pwa: result.scores.pwa,
      };
      
      auditProgress.completed++;
      console.log(`✓ Completed (${auditProgress.completed}/${auditProgress.total}): ${urlRecord.url} - Performance: ${result.scores.performance}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ Failed: ${urlRecord.url} - ${errorMessage}`);
      
      db.prepare(`
        UPDATE audits SET status = 'failed', error_message = ? WHERE id = ?
      `).run(errorMessage, auditId);
      
      // Update per-URL progress with error
      auditProgress.urls[i].status = 'failed';
      auditProgress.urls[i].error = errorMessage;
      
      auditProgress.completed++;
    }
  }
  
  // Mark as complete but keep the results
  auditProgress.inProgress = false;
  auditProgress.currentUrl = '';
  console.log('\nAll audits completed!');
});

app.get('/api/audit/status', (_req, res) => {
  res.json({
    inProgress: auditProgress.inProgress,
    total: auditProgress.total,
    completed: auditProgress.completed,
    currentUrl: auditProgress.currentUrl,
    urls: auditProgress.urls,
  });
});

export function startServer(port: number, dashboardDirectory?: string) {
  if (dashboardDirectory) app.use(express.static(dashboardDirectory));
  return app.listen(port, '127.0.0.1');
}

export async function stopAudits() {
  shuttingDown = true;
  await stopAuditBrowser();
}
