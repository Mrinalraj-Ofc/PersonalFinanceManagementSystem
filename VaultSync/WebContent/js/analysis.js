/* =============================================
   VaultSync — analysis.js
   Full AI analysis via OpenAI API,
   spending donut chart, precaution cards
============================================= */

// ── FULL ANALYSIS (called by button) ──────────
async function runFullAnalysis() {
  var key = localStorage.getItem('vs_openai_key');
  if (!key) {
    alert('Please configure your OpenAI API key first.');
    openApiKeyModal();
    return;
  }

  var stats  = JSON.parse(localStorage.getItem(statsKey())||'{}');
  var txs    = getTxData();
  var bills  = getBillData();
  var loans  = getLoanData();

  // Build a financial summary string for the prompt
  var income  = stats.income  || 0;
  var expense = stats.expense || 0;
  var balance = stats.balance || 0;
  var savings = Math.max(0, income - expense);
  var savRate = income>0 ? Math.round((savings/income)*100) : 0;

  // Summarize recent transactions
  var txSummary = txs.slice(0,10).map(function(t){
    return t.name + ' (' + t.type + '): ₹' + t.amount;
  }).join(', ');

  var billSummary = bills.map(function(b){
    return b.name + ' ₹' + b.amount + ' due ' + b.due;
  }).join(', ');

  var loanSummary = loans.map(function(l){
    return l.name + ' remaining ₹' + (l.total-l.paid) + ' EMI ₹' + l.emi;
  }).join(', ');

  var prompt =
    'You are a personal finance AI analyst for VaultSync, an Indian personal finance app.\n' +
    'User financial data:\n' +
    '- Monthly Income: ₹' + income + '\n' +
    '- Monthly Expenses: ₹' + expense + '\n' +
    '- Total Balance: ₹' + balance + '\n' +
    '- Net Savings: ₹' + savings + ' (' + savRate + '%)\n' +
    '- Recent transactions: ' + (txSummary||'None') + '\n' +
    '- Upcoming bills: ' + (billSummary||'None') + '\n' +
    '- Active loans: ' + (loanSummary||'None') + '\n\n' +
    'Respond ONLY with a valid JSON object (no markdown, no backticks) with this exact structure:\n' +
    '{\n' +
    '  "summary": "2-3 sentence paragraph describing overall financial health",\n' +
    '  "healthWord": "Strong|Moderate|Needs Attention",\n' +
    '  "savingsTarget": "e.g. 105%",\n' +
    '  "expenseControl": "e.g. 92%",\n' +
    '  "debtReduction": "On Track|Behind|Ahead",\n' +
    '  "precautions": [\n' +
    '    { "type": "warn|good|info", "title": "...", "text": "...", "date": "Apr 15" },\n' +
    '    { "type": "...", "title": "...", "text": "...", "date": "..." },\n' +
    '    { "type": "...", "title": "...", "text": "...", "date": "..." }\n' +
    '  ],\n' +
    '  "spending": [\n' +
    '    { "label": "Housing",       "amount": 0, "color": "#3b82f6" },\n' +
    '    { "label": "Food & Dining", "amount": 0, "color": "#22c55e" },\n' +
    '    { "label": "Transport",     "amount": 0, "color": "#f97316" },\n' +
    '    { "label": "Utilities",     "amount": 0, "color": "#8b5cf6" }\n' +
    '  ]\n' +
    '}\n' +
    'Fill in realistic amounts for spending based on the data. All amounts in ₹ Indian Rupees.';

  // Show loading state
  showAnalysisLoading(true);

  try {
    var res  = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        max_tokens: 900,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    var data  = await res.json();

    if (data.error) {
      showAnalysisLoading(false);
      alert('OpenAI Error: ' + data.error.message);
      return;
    }

    var text  = data.choices[0].message.content.trim();
    // Strip any accidental markdown fences
    text = text.replace(/^```json\n?/,'').replace(/\n?```$/,'').trim();

    var result = JSON.parse(text);
    renderAnalysis(result);

  } catch(e) {
    showAnalysisLoading(false);
    alert('Failed to get AI analysis. Check your API key and internet connection.\nError: ' + e.message);
  }
}

// ── RENDER ANALYSIS RESULTS ───────────────────
function renderAnalysis(r) {
  showAnalysisLoading(false);

  // Executive Summary
  var summaryHtml = r.summary.replace(r.healthWord,
    '<span class="highlight">'+r.healthWord+'</span>');
  document.getElementById('execText').innerHTML = summaryHtml;

  // Metrics
  document.getElementById('mSavings').textContent = r.savingsTarget   || '—';
  document.getElementById('mExpense').textContent = r.expenseControl  || '—';
  document.getElementById('mDebt').textContent    = r.debtReduction   || '—';

  // Trend arrows on metrics
  ['mSavings','mExpense'].forEach(function(id){
    var el  = document.getElementById(id);
    var val = parseFloat(el.textContent);
    if (!isNaN(val)) {
      var arrow = val >= 100 ? ' ↗' : ' ↘';
      el.textContent += arrow;
    }
  });

  // Precautions
  var pc = document.getElementById('precautionsList');
  if (!r.precautions||!r.precautions.length) {
    pc.innerHTML = '<p class="empty-hint">No precautions generated.</p>';
  } else {
    pc.innerHTML = r.precautions.map(function(p){
      var icon = p.type==='warn' ? '⚠️' : p.type==='good' ? '✅' : 'ℹ️';
      return '<div class="precaution-card">' +
        '<div class="pc-top">' +
          '<div class="pc-icon-wrap '+p.type+'">'+icon+'</div>' +
          '<span class="pc-title">'+escH(p.title)+'</span>' +
          '<span class="pc-date">'+escH(p.date||'')+'</span>' +
        '</div>' +
        '<p class="pc-body">'+escH(p.text)+'</p>' +
        (p.type==='warn' ? '<button class="btn-action" onclick="alert(\'Reviewing action for: '+escH(p.title)+'\')">Take Action</button>' : '') +
      '</div>';
    }).join('');
  }

  // Spending donut from AI data
  if (r.spending && r.spending.length) {
    drawSpendingDonut(r.spending);
    renderSpendingLegend(r.spending);
  }

  // Also update quick AI insights on Overview page
  if (r.precautions && r.precautions.length) {
    var dots = { warn:'orange', good:'green', info:'blue' };
    var html = r.precautions.slice(0,3).map(function(p){
      return '<div class="ai-insight-item">' +
        '<span class="ai-dot '+(dots[p.type]||'blue')+'"></span>' +
        '<div><h4>'+escH(p.title)+'</h4><p>'+escH(p.text)+'</p></div>' +
      '</div>';
    }).join('');
    var el = document.getElementById('aiInsights');
    if (el) el.innerHTML = html;
  }
}

function showAnalysisLoading(loading) {
  var execText = document.getElementById('execText');
  var pc       = document.getElementById('precautionsList');
  if (loading) {
    execText.innerHTML = '⏳ Generating AI analysis, please wait...';
    pc.innerHTML = '<p class="empty-hint">Fetching insights from AI...</p>';
    document.getElementById('mSavings').textContent = '...';
    document.getElementById('mExpense').textContent = '...';
    document.getElementById('mDebt').textContent    = '...';
  }
}

// ── SPENDING DONUT CHART ──────────────────────
var defaultSpending = [
  { label:'Housing',      amount:2000, color:'#3b82f6' },
  { label:'Food & Dining',amount:650,  color:'#22c55e' },
  { label:'Transport',    amount:350,  color:'#f97316' },
  { label:'Utilities',    amount:240,  color:'#8b5cf6' }
];

function drawSpendingDonut(data) {
  data = data || defaultSpending;
  var canvas = document.getElementById('donutCanvas');
  if (!canvas) return;
  var size = 160;
  canvas.width = size; canvas.height = size;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,size,size);

  var cx = size/2, cy = size/2, rO = 68, rI = 40;
  var total = data.reduce(function(s,d){ return s+(d.amount||0); },0);
  if (total === 0) return;

  var angle = -Math.PI/2;
  data.forEach(function(s){
    var sweep = (s.amount/total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,rO,angle,angle+sweep);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    // Small gap
    ctx.beginPath();
    ctx.arc(cx,cy,rO+1,angle,angle+sweep);
    ctx.strokeStyle='#fff';
    ctx.lineWidth=2;
    ctx.stroke();
    angle += sweep;
  });

  // Inner hole
  ctx.beginPath();
  ctx.arc(cx,cy,rI,0,Math.PI*2);
  ctx.fillStyle='#fff';
  ctx.fill();
}

function renderSpendingLegend(data) {
  data = data || defaultSpending;
  var el = document.getElementById('spendingLegend');
  if (!el) return;
  el.innerHTML = data.map(function(s){
    return '<div class="legend-row">' +
      '<div class="legend-label">' +
        '<div class="legend-dot" style="background:'+s.color+'"></div>' +
        escH(s.label) +
      '</div>' +
      '<span class="legend-val">₹'+fmt(s.amount)+'</span>' +
    '</div>';
  }).join('');
}

// Draw default donut on page load
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){
    drawSpendingDonut(defaultSpending);
    renderSpendingLegend(defaultSpending);
  }, 200);
});
