/* =============================================
   VaultSync — dashboard.js (core)
   Session, navigation, overview stats,
   cashflow chart, generate report
============================================= */

var currentUser = null;

// ── INIT ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  verifySession();
  setMonthChip();
  populateAnalysisMonths();
  setTodayDateInputs();
});

// ── SESSION ───────────────────────────────────
async function verifySession() {
  var stored = sessionStorage.getItem('vaultUser');
  if (stored) {
    currentUser = JSON.parse(stored);
    applyUserToUI();
    pingServer();
    return;
  }
  try {
    var res  = await fetch('SessionCheckServlet');
    var data = await res.json();
    if (data.loggedIn) {
      currentUser = { name: data.name, username: data.username, email: data.email, isNew: false };
      sessionStorage.setItem('vaultUser', JSON.stringify(currentUser));
      applyUserToUI();
    } else {
      window.location.href = 'index.html';
    }
  } catch(e) {
    // no backend — redirect back
    window.location.href = 'index.html';
  }
}

async function pingServer() {
  try {
    var res  = await fetch('SessionCheckServlet');
    var data = await res.json();
    if (!data.loggedIn) { sessionStorage.removeItem('vaultUser'); window.location.href = 'index.html'; }
  } catch(e) {}
}

function applyUserToUI() {
  if (!currentUser) return;
  var first = currentUser.name.split(' ')[0];
  document.getElementById('welcomeName').textContent = first;
  document.getElementById('sidebarName').textContent = currentUser.name;
  var initials = currentUser.name.split(' ').map(function(w){ return w[0]||''; }).join('').toUpperCase().slice(0,2);
  document.getElementById('userAvatar').textContent = initials;
  if (currentUser.isNew) {
    openModal('setupModal');
    currentUser.isNew = false;
    sessionStorage.setItem('vaultUser', JSON.stringify(currentUser));
  } else {
    loadStats();
    drawCashflowChart(6);
  }
}

// ── NAVIGATION ────────────────────────────────
function switchPage(pageId, linkEl) {
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  document.getElementById('page-' + pageId).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  if (linkEl) linkEl.classList.add('active');

  if (pageId === 'transactions') {
    showDayBanner();
    loadTransactions();
  }
  if (pageId === 'bills')     { loadBills(); loadLoans(); }
  if (pageId === 'analysis')  { setTimeout(drawSpendingDonut, 80); }
  if (pageId === 'overview')  { loadStats(); drawCashflowChart(6); }
}

// ── LOGOUT ────────────────────────────────────
function handleLogout() {
  if (!confirm('Are you sure you want to log out?')) return;
  sessionStorage.removeItem('vaultUser');
  fetch('LogoutServlet', { method:'POST' }).catch(function(){})
    .finally(function(){ window.location.href = 'index.html'; });
}

// ── NOTIFICATIONS ─────────────────────────────
function toggleNotif() {
  document.getElementById('notifDrop').classList.toggle('open');
}
document.addEventListener('click', function(e) {
  var btn  = document.getElementById('notifBtn');
  var drop = document.getElementById('notifDrop');
  if (drop && btn && !btn.contains(e.target) && !drop.contains(e.target)) {
    drop.classList.remove('open');
  }
});

// ── MODALS ────────────────────────────────────
function openModal(id) {
  var m = document.getElementById(id);
  if (m) { m.style.display = 'flex'; m.classList.add('open'); }
}
function closeModal(id) {
  var m = document.getElementById(id);
  if (m) { m.style.display = 'none'; m.classList.remove('open'); }
}
// Click outside modal box → close
document.addEventListener('click', function(e) {
  document.querySelectorAll('.modal-overlay.open').forEach(function(overlay) {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ── MONTH CHIP ────────────────────────────────
function setMonthChip() {
  var now = new Date();
  var label = now.toLocaleDateString('en-IN', { month:'long', year:'numeric' });
  var el = document.getElementById('monthChip');
  if (el) el.textContent = label;
}

function populateAnalysisMonths() {
  var sel = document.getElementById('analysisMonthSel');
  if (!sel) return;
  var now = new Date();
  for (var i = 0; i < 12; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var opt = document.createElement('option');
    opt.value = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    opt.textContent = d.toLocaleDateString('en-IN', { month:'long', year:'numeric' });
    sel.appendChild(opt);
  }
}

// ── SETUP MODAL (first login) ──────────────────
async function saveSetup() {
  var balance = parseFloat(document.getElementById('setupBalance').value) || 0;
  var income  = parseFloat(document.getElementById('setupIncome').value)  || 0;
  var expense = parseFloat(document.getElementById('setupExpense').value) || 0;
  var stats   = { balance: balance, income: income, expense: expense };
  localStorage.setItem(statsKey(), JSON.stringify(stats));
  renderStats(stats);
  await pushStats(stats);
  closeModal('setupModal');
  drawCashflowChart(6);
}

// ── EDIT STATS MODAL ──────────────────────────
function openEditStats() {
  var raw = localStorage.getItem(statsKey());
  if (raw) {
    var s = JSON.parse(raw);
    document.getElementById('editBalance').value = s.balance;
    document.getElementById('editIncome').value  = s.income;
    document.getElementById('editExpense').value = s.expense;
  }
  openModal('editStatsModal');
}

async function saveStats() {
  var balance = parseFloat(document.getElementById('editBalance').value) || 0;
  var income  = parseFloat(document.getElementById('editIncome').value)  || 0;
  var expense = parseFloat(document.getElementById('editExpense').value) || 0;
  var stats   = { balance: balance, income: income, expense: expense };
  localStorage.setItem(statsKey(), JSON.stringify(stats));
  renderStats(stats);
  await pushStats(stats);
  closeModal('editStatsModal');
}

function statsKey() {
  return 'vs_stats_' + (currentUser ? currentUser.username : 'guest');
}

async function loadStats() {
  var local = localStorage.getItem(statsKey());
  if (local) renderStats(JSON.parse(local));
  try {
    if (!currentUser) return;
    var res  = await fetch('OverviewServlet', {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body: new URLSearchParams({ action:'getStats', username: currentUser.username })
    });
    var d = await res.json();
    if (d.success) {
      var s = { balance: d.balance, income: d.income, expense: d.expense };
      localStorage.setItem(statsKey(), JSON.stringify(s));
      renderStats(s);
    }
  } catch(e) {}
  updateAvgStats();
}

function renderStats(s) {
  document.getElementById('totalBalance').textContent    = '₹' + fmt(s.balance);
  document.getElementById('monthlyIncome').textContent   = '₹' + fmt(s.income);
  document.getElementById('monthlyExpenses').textContent = '₹' + fmt(s.expense);
  var rate = s.income > 0 ? Math.round(((s.income - s.expense) / s.income) * 100) : 0;
  document.getElementById('savingsRate').textContent = rate + '%';
  document.getElementById('savingsNote').textContent =
    rate >= 50 ? 'Excellent performance this month.' :
    rate >= 30 ? 'Good savings rate — keep it up!' :
    rate >= 10 ? 'Try to reduce expenses further.' :
    'Review your expenses to improve savings.';
  updateAvgStats();
}

function updateAvgStats() {
  var raw = localStorage.getItem(statsKey());
  if (!raw) return;
  var s = JSON.parse(raw);
  document.getElementById('avgIncome').textContent  = '₹' + fmt(s.income  || 0);
  document.getElementById('avgExpense').textContent = '₹' + fmt(s.expense || 0);
  var sav = Math.max(0, (s.income||0) - (s.expense||0));
  document.getElementById('avgSavings').textContent = '₹' + fmt(sav);
}

async function pushStats(stats) {
  if (!currentUser) return;
  try {
    await fetch('OverviewServlet', {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        action:'saveStats', username: currentUser.username,
        balance: stats.balance, income: stats.income, expense: stats.expense
      })
    });
  } catch(e) {}
}

// ── CASHFLOW CHART ─────────────────────────────
var CF = {
  3:  { lbl:['Feb','Mar','Apr'],
        inc:[670000,690000,680000], exp:[250000,265000,259200] },
  6:  { lbl:['Nov','Dec','Jan','Feb','Mar','Apr'],
        inc:[660000,705000,720000,670000,690000,680000],
        exp:[275000,260000,298000,250000,265000,259200] },
  12: { lbl:['May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr'],
        inc:[620000,645000,650000,660000,640000,670000,660000,705000,720000,670000,690000,680000],
        exp:[290000,280000,270000,275000,268000,272000,275000,260000,298000,250000,265000,259200] }
};

function updateCashflowChart(v) { drawCashflowChart(parseInt(v)); }

function drawCashflowChart(months) {
  var canvas = document.getElementById('cashflowCanvas');
  if (!canvas) return;
  var W = canvas.parentElement.clientWidth || 560, H = 190;
  canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);

  var d   = CF[months] || CF[6];
  var lbl = d.lbl, inc = d.inc, exp = d.exp;
  var pad = { t:16, r:90, b:30, l:58 };
  var cW  = W-pad.l-pad.r, cH = H-pad.t-pad.b, n = lbl.length;
  var maxV = Math.max.apply(null, inc.concat(exp)) * 1.15;
  var xOf  = function(i){ return pad.l + (i/(n-1))*cW; };
  var yOf  = function(v){ return pad.t + cH - (v/maxV)*cH; };

  // Grid
  ctx.strokeStyle='#e5e7eb'; ctx.lineWidth=1;
  for (var g=0;g<=4;g++) {
    var gy = pad.t + (cH/4)*g;
    ctx.beginPath(); ctx.moveTo(pad.l,gy); ctx.lineTo(W-pad.r,gy); ctx.stroke();
    ctx.fillStyle='#9ca3af'; ctx.font='10px Inter,sans-serif'; ctx.textAlign='right';
    ctx.fillText('₹'+sN(Math.round(maxV*(1-g/4))), pad.l-5, gy+4);
  }
  lbl.forEach(function(l,i){
    ctx.fillStyle='#9ca3af'; ctx.textAlign='center'; ctx.font='11px Inter,sans-serif';
    ctx.fillText(l, xOf(i), H-6);
  });

  function drawLine(data, color, fill) {
    ctx.beginPath();
    data.forEach(function(v,i){
      var x=xOf(i), y=yOf(v);
      if (i===0) { ctx.moveTo(x,y); return; }
      var px=xOf(i-1), py=yOf(data[i-1]), cpx=(px+x)/2;
      ctx.bezierCurveTo(cpx,py,cpx,y,x,y);
    });
    ctx.strokeStyle=color; ctx.lineWidth=2.5; ctx.stroke();
    ctx.lineTo(xOf(n-1),pad.t+cH); ctx.lineTo(xOf(0),pad.t+cH); ctx.closePath();
    var gr = ctx.createLinearGradient(0,pad.t,0,pad.t+cH);
    gr.addColorStop(0,fill); gr.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=gr; ctx.fill();
    data.forEach(function(v,i){
      ctx.beginPath(); ctx.arc(xOf(i),yOf(v),4,0,Math.PI*2);
      ctx.fillStyle='#fff'; ctx.fill();
      ctx.strokeStyle=color; ctx.lineWidth=2; ctx.stroke();
    });
  }
  drawLine(inc,'#22c55e','rgba(34,197,94,.13)');
  drawLine(exp,'#6366f1','rgba(99,102,241,.13)');

  // Legend
  var lx = W-pad.r+8, ly = pad.t+8;
  [['#22c55e','Income'],['#6366f1','Expense']].forEach(function(pair,i){
    var y=ly+i*18;
    ctx.fillStyle=pair[0]; ctx.fillRect(lx,y,12,3);
    ctx.fillStyle='#6b7280'; ctx.font='11px Inter,sans-serif'; ctx.textAlign='left';
    ctx.fillText(pair[1],lx+16,y+4);
  });
}

// ── GENERATE REPORT ───────────────────────────
function generateReport() {
  var txs   = getTxData();
  var bills = getBillData();
  var loans = getLoanData();
  var stats = JSON.parse(localStorage.getItem(statsKey())||'{}');
  var line  = '─'.repeat(64);
  var r = '';
  r += '╔══════════════════════════════════════════════════════════════════╗\n';
  r += '║                  VAULTSYNC — FINANCIAL REPORT                  ║\n';
  r += '╚══════════════════════════════════════════════════════════════════╝\n\n';
  r += 'User      : ' + (currentUser ? currentUser.name : 'N/A') + '\n';
  r += 'Email     : ' + (currentUser ? currentUser.email : 'N/A') + '\n';
  r += 'Generated : ' + new Date().toLocaleString('en-IN') + '\n\n';
  r += line + '\n  OVERVIEW\n' + line + '\n';
  r += '  Total Balance    : ₹' + fmt(stats.balance||0) + '\n';
  r += '  Monthly Income   : ₹' + fmt(stats.income||0)  + '\n';
  r += '  Monthly Expense  : ₹' + fmt(stats.expense||0) + '\n';
  var rate = stats.income>0 ? Math.round(((stats.income-stats.expense)/stats.income)*100) : 0;
  r += '  Net Savings Rate : ' + rate + '%\n\n';
  r += line + '\n  TRANSACTIONS (' + txs.length + ')\n' + line + '\n';
  if (!txs.length) { r += '  No transactions recorded.\n'; }
  else {
    r += '  DATE        TYPE       AMOUNT          DESCRIPTION\n';
    txs.forEach(function(t){
      var s = t.type==='income'||t.type==='savings' ? '+' : '−';
      r += '  ' + t.date + '  ' + t.type.padEnd(9) + ' ' + s + '₹' + fmt(t.amount).padStart(12) + '  ' + t.name + '\n';
    });
  }
  r += '\n' + line + '\n  BILLS (' + bills.length + ')\n' + line + '\n';
  bills.forEach(function(b){ r += '  ' + b.due + '  ₹' + fmt(b.amount).padStart(12) + '  ' + b.name + '\n'; });
  if (!bills.length) r += '  No bills recorded.\n';
  r += '\n' + line + '\n  LOANS (' + loans.length + ')\n' + line + '\n';
  loans.forEach(function(l){ r += '  ' + l.name + '  Remaining: ₹' + fmt(l.remaining) + '  EMI: ₹' + fmt(l.emi) + '\n'; });
  if (!loans.length) r += '  No loans recorded.\n';
  r += '\n' + line + '\n  END OF REPORT\n' + line + '\n';
  var blob = new Blob([r], { type:'text/plain;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href=url; a.download='VaultSync_Report_'+new Date().toISOString().slice(0,10)+'.txt';
  a.click(); URL.revokeObjectURL(url);
}

// ── QUICK AI OVERVIEW ─────────────────────────
async function runQuickAnalysis() {
  var key = localStorage.getItem('vs_openai_key');
  if (!key) {
    document.getElementById('aiInsights').innerHTML =
      '<div class="ai-placeholder"><p>Please configure your OpenAI API key first.</p></div>';
    openApiKeyModal();
    return;
  }
  document.getElementById('aiInsights').innerHTML =
    '<div class="ai-placeholder"><p>⏳ Generating insights...</p></div>';
  var stats = JSON.parse(localStorage.getItem(statsKey())||'{}');
  var prompt = 'Give me 3 short financial insights (each max 1 sentence) based on: ' +
    'Income ₹' + (stats.income||0) + ', Expense ₹' + (stats.expense||0) +
    ', Balance ₹' + (stats.balance||0) + '. Format as JSON array: [{dot:"orange|green|blue",title:"...",text:"..."}]';
  try {
    var res  = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+key },
      body: JSON.stringify({ model:'gpt-3.5-turbo', max_tokens:400,
        messages:[{role:'user',content:prompt}] })
    });
    var data = await res.json();
    var text = data.choices[0].message.content;
    var clean = text.replace(/```json|```/g,'').trim();
    var insights = JSON.parse(clean);
    var html = insights.map(function(i){
      return '<div class="ai-insight-item"><span class="ai-dot '+i.dot+'"></span>' +
        '<div><h4>'+escH(i.title)+'</h4><p>'+escH(i.text)+'</p></div></div>';
    }).join('');
    document.getElementById('aiInsights').innerHTML = html;
  } catch(e) {
    document.getElementById('aiInsights').innerHTML =
      '<div class="ai-placeholder"><p>Could not fetch AI insights. Check your API key.</p></div>';
  }
}

// ── API KEY MODAL ─────────────────────────────
function openApiKeyModal() { openModal('apiKeyModal'); }

function saveApiKey() {
  var key = document.getElementById('apiKeyInput').value.trim();
  if (!key.startsWith('sk-')) {
    showKeyStatus('Key should start with sk-', 'err'); return;
  }
  localStorage.setItem('vs_openai_key', key);
  showKeyStatus('API key saved successfully!', 'ok');
  setTimeout(function(){ closeModal('apiKeyModal'); }, 1200);
}

function showKeyStatus(msg, type) {
  var s = document.getElementById('apiKeyStatus');
  s.textContent = msg; s.className = 'api-key-status ' + type; s.style.display='block';
}

// ── DATE & UTILITY ────────────────────────────
function setTodayDateInputs() {
  var today = new Date().toISOString().slice(0,10);
  ['txDate','billDue','loanNext'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value = today;
  });
}

function showDayBanner() {
  var banner = document.getElementById('dayBanner');
  var txt    = document.getElementById('dayBannerText');
  if (!banner||!txt) return;
  var now  = new Date();
  var day  = now.toLocaleDateString('en-IN',{weekday:'long'});
  var date = now.toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});
  var name = currentUser ? currentUser.name.split(' ')[0] : 'there';
  txt.textContent = 'Welcome ' + name + ' to ' + day + ' — ' + date;
  banner.style.display = 'flex';
}

// ── SHARED STORAGE HELPERS ────────────────────
function txKey()   { return 'vs_tx_'   + (currentUser?currentUser.username:'guest'); }
function billKey() { return 'vs_bills_'+ (currentUser?currentUser.username:'guest'); }
function loanKey() { return 'vs_loans_'+ (currentUser?currentUser.username:'guest'); }

function getTxData()   { return JSON.parse(localStorage.getItem(txKey())  ||'[]'); }
function getBillData() { return JSON.parse(localStorage.getItem(billKey())||'[]'); }
function getLoanData() { return JSON.parse(localStorage.getItem(loanKey())||'[]'); }

function saveTxData(d)   { localStorage.setItem(txKey(),   JSON.stringify(d)); }
function saveBillData(d) { localStorage.setItem(billKey(), JSON.stringify(d)); }
function saveLoanData(d) { localStorage.setItem(loanKey(), JSON.stringify(d)); }

// ── FORMATTING ────────────────────────────────
function fmt(n) { return Number(n).toLocaleString('en-IN'); }
function sN(n) {
  if (n>=10000000) return (n/10000000).toFixed(1)+'Cr';
  if (n>=100000)   return (n/100000).toFixed(0)+'L';
  if (n>=1000)     return (n/1000).toFixed(0)+'K';
  return String(n);
}
function escH(s) {
  var d = document.createElement('div'); d.textContent = s||''; return d.innerHTML;
}
function todayStr() { return new Date().toISOString().slice(0,10); }
