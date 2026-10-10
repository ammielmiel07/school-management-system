import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendPort = 32000 + Math.floor(Math.random() * 10000);
const frontendUrl = `http://localhost:${frontendPort}`;
const artifactDir = path.join(frontend, '.next', 'browser-smoke');
fs.mkdirSync(artifactDir, { recursive: true });
const browserPath = process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const session = role => `header.${Buffer.from(JSON.stringify({ role_id: role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
let failAccounts = false;
const grade = trimester => ({ subject_name: 'Mathematics', transmuted_grade: 80 + Number(trimester), initial_grade: 75, faculty_first_name: 'Test', faculty_last_name: 'Teacher' });
const child = { learner: { lrn: '123456789012', first_name: 'Test', last_name: 'Learner' }, enrollment: { section_name: 'Ruby', grade_level: 7, grades_visible: true } };
const fixtures = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let status = 200;
  let data = { success: true };
  switch (url.pathname) {
    case '/api/login': {
      let body = ''; for await (const chunk of req) body += chunk;
      const credentials = JSON.parse(body);
      if (credentials.password !== 'demo') { status = 401; data = { error: 'Invalid username or password.' }; }
      else { const role = { admin: 1, faculty: 2, learner: 3, parent: 4 }[credentials.username]; data = { success: true, token: session(role), user: { id: 1, role_id: role } }; }
      break;
    }
    case '/api/settings': data.settings = { current_school_year: '2026-2027', active_trisemester: 3 }; break;
    case '/api/admin/dashboard': data = { success: true, active_school_year: '2026-2027', active_trisemester: 3, stats: { total_learners: 24, total_faculty: 8, enrolled_this_year: 24, active_sections: 2 } }; break;
    case '/api/admin/carousel': data.images = []; break;
    case '/api/admin/calendar': data.events = [{ id: 1, title: 'School Assembly', event_date: '2026-10-15', description: 'Meet in the school hall.' }]; break;
    case '/api/admin/school-days': data = url.searchParams.has('monthName') ? { success: true, totalDays: 20 } : { success: true, calendar: [{ month_name: 'October', total_days: 20 }] }; break;
    case '/api/admin/grading': data.subjects = [{ id: 1, subject_name: 'Mathematics', ww_weight: 30, pt_weight: 50, ex_weight: 20 }]; break;
    case '/api/admin/accounts':
      if (failAccounts) { status = 503; data = { error: 'Database is temporarily unavailable.' }; }
      else data.accounts = [{ user_id: 7, username: '1234567', role: 'faculty', first_name: 'Test', last_name: 'Teacher', identifier: '1234567' }];
      break;
    case '/api/faculty/gradebook/1': data = { success: true, students: [{ enrollment_id: 1, lrn: '123456789012', first_name: 'Test', last_name: 'Learner' }], itemScores: [{ enrollment_id: 1, grade_item_id: 1, score: 10 }, { enrollment_id: 1, grade_item_id: 3, score: 20 }, { enrollment_id: 1, grade_item_id: 4, score: 10 }], weights: { ww: 30, pt: 50, ex: 20 } }; break;
    case '/api/faculty/grade-items/1': data.items = [{ id: 1, component: 'WW', item_name: 'Quiz 1', max_score: '10' }, { id: 2, component: 'WW', item_name: 'Quiz 2', max_score: '10' }, { id: 3, component: 'PT', item_name: 'Project', max_score: '20' }, { id: 4, component: 'EX', item_name: 'Exam', max_score: '10' }]; break;
    case '/api/faculty/save-grades': await new Promise(resolve => setTimeout(resolve, 500)); break;
    case '/api/learner/grades': data = { success: true, school_year: '2026-2027', active_trisemester: 3, ...child, grades: [grade(url.searchParams.get('trimester'))] }; break;
    case '/api/parent/children-grades': data = { success: true, school_year: '2026-2027', active_trisemester: 3, children: [{ ...child, grades: [grade(url.searchParams.get('trimester'))] }] }; break;
    default: status = 404; data = { error: 'Fixture endpoint not found.' };
  }
  res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data));
});
await new Promise(resolve => fixtures.listen(0, '127.0.0.1', resolve));
const next = spawn(process.execPath, [path.join(frontend, 'node_modules/next/dist/bin/next'), 'dev', '--port', String(frontendPort)], {
  cwd: frontend, windowsHide: true, env: { ...process.env, BACKEND_URL: `http://127.0.0.1:${fixtures.address().port}` }, stdio: ['ignore', 'pipe', 'pipe'],
});
let nextLog = '';
next.stdout.on('data', chunk => { nextLog += chunk; }); next.stderr.on('data', chunk => { nextLog += chunk; });
let browser;
let socket;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await predicate()) return; await pause(150); }
  throw new Error('Timed out waiting for the browser.');
}
try {
  await waitFor(async () => { try { return (await fetch(`${frontendUrl}/login`, { signal: AbortSignal.timeout(5000) })).ok; } catch { return false; } });
  console.log('Frontend test server is ready.');
  const profile = path.join(artifactDir, `profile-${process.pid}`);
  browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let debugUrl;
  let browserLog = '';
  let browserExit;
  browser.on('error', error => { browserExit = error.message; });
  browser.on('exit', code => { browserExit = `Browser exited with code ${code}. ${browserLog.slice(-1500)}`; });
  browser.stderr.on('data', chunk => { browserLog += chunk; const match = chunk.toString().match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) debugUrl = match[1]; });
  await waitFor(() => { if (browserExit) throw new Error(browserExit); return !!debugUrl; });
  const debugOrigin = debugUrl.replace('ws:', 'http:').split('/devtools/')[0];
  const tab = await (await fetch(`${debugOrigin}/json/new?about:blank`, { method: 'PUT', signal: AbortSignal.timeout(5000) })).json();
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await Promise.race([new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', () => reject(new Error('Browser connection failed.')), { once: true }); }), pause(5000).then(() => { throw new Error('Browser connection timed out.'); })]);
  console.log('Headless browser is connected.');
  const pending = new Map(); let id = 0; const exceptions = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) { const callback = pending.get(message.id); if (!callback) return; clearTimeout(callback.timer); pending.delete(message.id); if (message.error) callback.reject(new Error(message.error.message)); else callback.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
  });
  socket.addEventListener('close', () => { for (const callback of pending.values()) { clearTimeout(callback.timer); callback.reject(new Error('The browser closed unexpectedly.')); } pending.clear(); });
  const command = (method, params = {}) => new Promise((resolve, reject) => { const requestId = ++id; const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`Browser command timed out: ${method}`)); }, 10000); pending.set(requestId, { resolve, reject, timer }); socket.send(JSON.stringify({ id: requestId, method, params })); });
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(`${result.exceptionDetails.exception?.description || result.exceptionDetails.text} while evaluating ${expression.slice(0, 140)}`);
    return result.result.value;
  };
  const navigate = async route => { await command('Page.navigate', { url: `${frontendUrl}${route}` }); await waitFor(() => evaluate('document.readyState === "complete"')); };
  const setSession = role => evaluate(`localStorage.setItem('token', ${JSON.stringify(session(role))}); localStorage.setItem('role_id', '${role}')`);
  const screenshot = async name => { const result = await command('Page.captureScreenshot'); fs.writeFileSync(path.join(artifactDir, name), Buffer.from(result.data, 'base64')); };
  await command('Runtime.enable'); await command('Page.enable');
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate('/login');
  await waitFor(() => evaluate('Object.keys(document.querySelector("#username") || {}).some(key => key.startsWith("__reactProps"))'));
  console.log('Login page loaded.');
  const fill = (selector, value) => evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await fill('#username', 'admin'); await fill('#password', 'wrong');
  await evaluate('document.querySelector("form").requestSubmit()');
  await waitFor(() => evaluate('document.querySelector("[role=alert]")?.textContent.includes("Invalid username")'));
  console.log('Login validation passed.');
  await fill('#password', 'demo'); await evaluate('document.querySelector("form").requestSubmit()');
  await waitFor(() => evaluate('location.pathname === "/admin/dashboard" && !!document.querySelector("a[aria-current=page]")'));
  await waitFor(() => evaluate('document.body.textContent.includes("24") && Array.from(document.images).every(img => img.complete)'));
  await screenshot('admin-desktop.png');
  console.log('Desktop navigation passed.');
  assert.equal(await evaluate('document.querySelector("a[aria-current=page]").textContent'), 'Dashboard');
  await command('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await pause(100);
  await evaluate('document.querySelector("button[aria-controls=portal-navigation]").click()');
  await waitFor(() => evaluate('document.querySelector("button[aria-controls=portal-navigation]").getAttribute("aria-expanded") === "true"'));
  await pause(350);
  await screenshot('admin-mobile-menu.png');
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await waitFor(() => evaluate('document.querySelector("button[aria-controls=portal-navigation]").getAttribute("aria-expanded") === "false"'));
  await pause(350);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await setSession(2); await navigate('/faculty/my-classes/1');
  await waitFor(() => evaluate('document.querySelector("tbody")?.textContent.includes("Learner")'));
  assert.equal(await evaluate('Array.from(document.querySelectorAll("tbody tr"))[1].textContent.includes("85.00")'), true);
  assert.equal(await evaluate('document.querySelector("button[aria-controls=portal-navigation]") !== null'), true);
  await screenshot('faculty-mobile-gradebook.png');
  await setSession(3); await navigate('/learner/my-grades');
  await waitFor(() => evaluate('Array.from(document.querySelectorAll("tbody td")).some(cell => cell.textContent.trim() === "83")'));
  assert.equal(await evaluate('getComputedStyle(document.querySelector("section[tabindex]")).overflowX'), 'auto');
  await screenshot('learner-mobile-grades.png');
  await setSession(4); await navigate('/parent/child-grades');
  await waitFor(() => evaluate('Array.from(document.querySelectorAll("tbody td")).some(cell => cell.textContent.trim() === "83")'));
  await navigate('/admin/accounts');
  await waitFor(() => evaluate('location.pathname === "/login"'));
  await setSession(1); await navigate('/admin/grading-setup');
  await waitFor(() => evaluate('document.querySelector("main")?.textContent.includes("30%")'));
  assert.equal(await evaluate('document.querySelector("main").textContent.includes("3000%")'), false);
  await navigate('/admin/calendar');
  await waitFor(() => evaluate('Object.keys(document.querySelector("main button") || {}).some(key => key.startsWith("__reactProps"))'));
  await evaluate('Array.from(document.querySelectorAll("button")).find(button => button.textContent.includes("School Days")).click()');
  await waitFor(() => evaluate('document.querySelector("input[type=number]")?.value === "20"'));
  assert.equal(await evaluate('document.querySelector("input[type=text]").value'), '2026-2027');
  await fill('input[type=number]', '0'); await evaluate('document.querySelector("main form").requestSubmit()');
  await waitFor(() => evaluate('document.querySelector("main [role=status]")?.textContent.includes("successfully updated")'));
  await setSession(1); failAccounts = true; await navigate('/admin/accounts');
  await waitFor(() => evaluate('document.querySelector("main [role=alert]")?.textContent.includes("Retry")'));
  await screenshot('accounts-error.png');
  assert.deepEqual(exceptions, []);
  console.log('Browser checks passed: login errors, login redirect, desktop navigation, mobile menu/Escape, grade calculations, active trimester synchronization, scrollable grades, grading percentages, school calendar setup, role guards, and load-error recovery.');
  console.log(`Screenshots: ${artifactDir}`);
} catch (error) {
  console.error(error.message);
  console.error(nextLog.slice(-3000));
  process.exitCode = 1;
} finally {
  socket?.close();
  for (const childProcess of [browser, next]) {
    if (!childProcess?.pid) continue;
    if (process.platform === 'win32') {
      try { execFileSync('taskkill.exe', ['/PID', String(childProcess.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch { childProcess.kill(); }
    } else childProcess.kill();
  }
  fixtures.closeAllConnections();
  await new Promise(resolve => fixtures.close(resolve));
}
