/* =============================================
   VaultSync Dashboard — dashboard.js  v2
   ─────────────────────────────────────────
   Handles:
   1. Session verification on page load
   2. Page navigation (Overview / Transactions / Bills / Analysis)
   3. Overview stats → localStorage + backend
   4. Transactions CRUD → localStorage + backend
   5. Bills CRUD       → localStorage + backend
   6. Cash flow chart (canvas, hand-drawn)
   7. Analysis charts  (canvas, hand-drawn)
   8. AI Insights rotation
   9. Report export
   10. Notifications dropdown
   ============================================= */

// ─────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────
let currentUser = null;

// ─────────────────────────────────────────────
// 1. INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await verifySession();
    setTodayDate();
    loadOverviewStats();
    loadTransactions();
    loadBills();
    initCashflowChart();
});

// ─────────────────────────────────────────────
// 2. SESSION VERIFICATION
// ─────────────────────────────────────────────
async function verifySession() {
    const stored = sessionStorage.getItem('vaultUser');
    if (stored) {
        currentUser = JSON.parse(stored);
        applyUserToUI();
        confirmServerSession(); // silent background check
        return;
    }
    // No sessionStorage entry — ask the server
    try {
        const res  = await fetch('SessionCheckServlet');
        const data = await res.json();
        if (data.loggedIn) {
            currentUser = { name: data.name, username: data.username, email: data.email, isNew: false };
            sessionStorage.setItem('vaultUser', JSON.stringify(currentUser));
            applyUserToUI();
        } else {
            window.location.href = 'index.html';
        }
    } catch (err) {
        console.warn('[Session] Backend unavailable, redirecting to login.');
        window.location.href = 'index.html';
    }
}

async function confirmServerSession() {
    try {
        const res  = await fetch('SessionCheckServlet');
        const data = await res.json();
        if (!data.loggedIn) {
            sessionStorage.removeItem('vaultUser');
            window.location.href = 'index.html';
        }
    } catch (_) { /* offline / demo mode — ignore */ }
}

function applyUserToUI() {
    if (!currentUser) return;
    const firstName = currentUser.name.split(' ')[0];
    document.getElementById('welcomeName').textContent = firstName;
    document.getElementById('sidebarName').textContent = currentUser.name;

    const initials = currentUser.name.split(' ')
        .map(w => w[0] || '').join('').toUpperCase().slice(0, 2);
    document.getElementById('userAvatar').textContent = initials;

    if (currentUser.isNew) {
        document.getElementById('setupModal').style.display = 'flex';
        currentUser.isNew = false;
        sessionStorage.setItem('vaultUser', JSON.stringify(currentUser));
    }
}

// ─────────────────────────────────────────────
// 3. PAGE NAVIGATION
// ─────────────────────────────────────────────
function switchPage(pageId, linkEl) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    document.getElementById('page-' + pageId).classList.add('active-page');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (linkEl) linkEl.classList.add('active');
    // Analysis charts need the canvas to be visible first
    if (pageId === 'analysis') setTimeout(drawAnalysisCharts, 60);
}

// ─────────────────────────────────────────────
// 4. LOGOUT
// ─────────────────────────────────────────────
function handleLogout() {
    if (!confirm('Are you sure you want to log out?')) return;
    sessionStorage.removeItem('vaultUser');
    fetch('LogoutServlet', { method: 'POST' }).catch(() => {})
        .finally(() => { window.location.href = 'index.html'; });
}

// ─────────────────────────────────────────────
// 5. NOTIFICATIONS
// ─────────────────────────────────────────────
function toggleNotifications() {
    document.getElementById('notifDropdown').classList.toggle('open');
}
document.addEventListener('click', (e) => {
    const btn  = document.querySelector('.notif-btn');
    const drop = document.getElementById('notifDropdown');
    if (drop && btn && !btn.contains(e.target) && !drop.contains(e.target))
        drop.classList.remove('open');
});

// ─────────────────────────────────────────────
// 6. SETUP MODAL
// ─────────────────────────────────────────────
async function saveSetup() {
    const balance = parseFloat(document.getElementById('setupBalance').value) || 0;
    const income  = parseFloat(document.getElementById('setupIncome').value)  || 0;
    const expense = parseFloat(document.getElementById('setupExpense').value) || 0;
    const stats   = { balance, income, expense };
    localStorage.setItem(getStatsKey(), JSON.stringify(stats));
    renderOverviewStats(stats);
    await saveStatsToServer(stats);
    document.getElementById('setupModal').style.display = 'none';
}

// ─────────────────────────────────────────────
// 7. OVERVIEW STATS
// ─────────────────────────────────────────────
function getStatsKey() {
    return 'vaultsync_stats_' + (currentUser ? currentUser.username : 'guest');
}

async function loadOverviewStats() {
    const localRaw = localStorage.getItem(getStatsKey());
    if (localRaw) renderOverviewStats(JSON.parse(localRaw));
    try {
        if (!currentUser) return;
        const res  = await fetch('OverviewServlet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'getStats', username: currentUser.username })
        });
        const data = await res.json();
        if (data.success) {
            const stats = { balance: data.balance, income: data.income, expense: data.expense };
            localStorage.setItem(getStatsKey(), JSON.stringify(stats));
            renderOverviewStats(stats);
        }
    } catch (_) { /* offline */ }
}

function renderOverviewStats(stats) {
    document.getElementById('totalBalance').textContent    = '₹' + fmt(stats.balance);
    document.getElementById('monthlyIncome').textContent   = '₹' + fmt(stats.income);
    document.getElementById('monthlyExpenses').textContent = '₹' + fmt(stats.expense);
    const rate = stats.income > 0
        ? Math.round(((stats.income - stats.expense) / stats.income) * 100) : 0;
    document.getElementById('savingsRate').textContent = rate + '%';
}

async function saveStatsToServer(stats) {
    if (!currentUser) return;
    try {
        await fetch('OverviewServlet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'saveStats', username: currentUser.username,
                balance: stats.balance, income: stats.income, expense: stats.expense
            })
        });
    } catch (_) { /* offline */ }
}

// ─────────────────────────────────────────────
// 8. GENERATE REPORT
// ─────────────────────────────────────────────
function generateReport() {
    const txs   = getTransactions();
    const bills = getBills();
    const stats = JSON.parse(localStorage.getItem(getStatsKey()) || '{}');
    const line  = '─'.repeat(62);
    let r = '';
    r += '╔══════════════════════════════════════════════════════════════╗\n';
    r += '║              VAULTSYNC — FINANCIAL REPORT                  ║\n';
    r += '╚══════════════════════════════════════════════════════════════╝\n\n';
    r += `User      : ${currentUser ? currentUser.name : 'N/A'}\n`;
    r += `Email     : ${currentUser ? currentUser.email : 'N/A'}\n`;
    r += `Generated : ${new Date().toLocaleString('en-IN')}\n\n`;
    r += line + '\n  OVERVIEW\n' + line + '\n';
    r += `  Total Balance    : ₹${fmt(stats.balance || 0)}\n`;
    r += `  Monthly Income   : ₹${fmt(stats.income  || 0)}\n`;
    r += `  Monthly Expense  : ₹${fmt(stats.expense || 0)}\n`;
    const rate = stats.income > 0 ? Math.round(((stats.income - stats.expense) / stats.income) * 100) : 0;
    r += `  Net Savings Rate : ${rate}%\n\n`;
    r += line + `\n  TRANSACTIONS (${txs.length})\n` + line + '\n';
    if (!txs.length) {
        r += '  No transactions recorded.\n';
    } else {
        r += '  DATE        TYPE       AMOUNT          DESCRIPTION\n';
        txs.forEach(t => {
            const s = t.type === 'income' ? '+' : '−';
            r += `  ${t.date}  ${t.type.padEnd(9)} ${s}₹${fmt(t.amount).padStart(13)}  ${t.desc}\n`;
        });
    }
    r += '\n' + line + `\n  BILLS & LOANS (${bills.length})\n` + line + '\n';
    if (!bills.length) {
        r += '  No bills recorded.\n';
    } else {
        r += '  DUE DATE    TYPE    AMOUNT          NAME\n';
        bills.forEach(b => {
            r += `  ${b.due}  ${b.type.padEnd(6)}  ₹${fmt(b.amount).padStart(13)}  ${b.name}\n`;
        });
    }
    r += '\n' + line + '\n  END OF REPORT\n' + line + '\n';
    const blob = new Blob([r], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `VaultSync_Report_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// 9. AI INSIGHTS
// ─────────────────────────────────────────────
const INSIGHTS = [
    { dot:'orange', title:'High Utility Expenditure Expected',
      text:'Your utility bills are trending 15% higher this month vs the 6-month average. Review subscriptions and consider usage-based plans.' },
    { dot:'green',  title:'Savings Goal on Track',
      text:'Consistent contributions over the last 3 months put you on pace to hit your annual investment goal. Keep it up!' },
    { dot:'blue',   title:'Low Expense Month Detected',
      text:'Expenses are below your 6-month average — a great time to boost your emergency fund or top up a SIP.' },
    { dot:'orange', title:'Loan EMI Due in 5 Days',
      text:'Ensure your account has sufficient balance to avoid late payment penalties on your home loan EMI.' },
    { dot:'green',  title:'Income Increased This Month',
      text:'Your income is 8% higher than last month. Consider routing the surplus into a liquid fund for better returns.' },
    { dot:'blue',   title:'Spending Spike — Food Category',
      text:'Food expenses are up 22% vs last month. Consider meal planning to bring costs back in line.' }
];
let insightStart = 0;

function refreshInsights() {
    insightStart = (insightStart + 3) % INSIGHTS.length;
    const list  = document.getElementById('insightList');
    const items = [0, 1, 2].map(d => INSIGHTS[(insightStart + d) % INSIGHTS.length]);
    list.innerHTML = items.map(i => `
        <div class="insight-item">
            <span class="insight-dot ${i.dot}"></span>
            <div class="insight-body"><h4>${i.title}</h4><p>${i.text}</p></div>
        </div>`).join('');
}

// ─────────────────────────────────────────────
// 10. CASHFLOW CHART
// ─────────────────────────────────────────────
const CF_DATA = {
    3:  { labels:['Feb','Mar','Apr'],
          income: [670000,690000,680000], expense:[250000,265000,259200] },
    6:  { labels:['Nov','Dec','Jan','Feb','Mar','Apr'],
          income: [660000,705000,720000,670000,690000,680000],
          expense:[275000,260000,298000,250000,265000,259200] },
    12: { labels:['May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr'],
          income: [620000,645000,650000,660000,640000,670000,660000,705000,720000,670000,690000,680000],
          expense:[290000,280000,270000,275000,268000,272000,275000,260000,298000,250000,265000,259200] }
};

function initCashflowChart() { drawCashflowChart(6); }
function updateChart(v) { drawCashflowChart(parseInt(v)); }

function drawCashflowChart(months) {
    const canvas = document.getElementById('cashflowChart');
    if (!canvas) return;
    const W = canvas.parentElement.clientWidth || 580, H = 200;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);

    const { labels, income, expense } = CF_DATA[months] || CF_DATA[6];
    const pad = {top:20,right:100,bottom:32,left:62};
    const cW = W-pad.left-pad.right, cH = H-pad.top-pad.bottom;
    const n  = labels.length;
    const maxV = Math.max(...income,...expense)*1.15;
    const xOf  = i => pad.left + (i/(n-1))*cW;
    const yOf  = v => pad.top  + cH - (v/maxV)*cH;

    // Grid
    ctx.strokeStyle='#e5e7eb'; ctx.lineWidth=1;
    for (let g=0;g<=4;g++) {
        const y=pad.top+(cH/4)*g;
        ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(W-pad.right,y); ctx.stroke();
        ctx.fillStyle='#9ca3af'; ctx.font='10px DM Sans,sans-serif'; ctx.textAlign='right';
        ctx.fillText('₹'+shortNum(Math.round(maxV*(1-g/4))),pad.left-6,y+4);
    }
    labels.forEach((l,i)=>{
        ctx.fillStyle='#9ca3af'; ctx.textAlign='center'; ctx.font='11px DM Sans,sans-serif';
        ctx.fillText(l,xOf(i),H-6);
    });

    function drawArea(data,lineColor,fillColor) {
        ctx.beginPath();
        data.forEach((v,i)=>{
            const x=xOf(i),y=yOf(v);
            if (i===0){ctx.moveTo(x,y);return;}
            const px=xOf(i-1),py=yOf(data[i-1]),cx=(px+x)/2;
            ctx.bezierCurveTo(cx,py,cx,y,x,y);
        });
        ctx.strokeStyle=lineColor; ctx.lineWidth=2.5; ctx.stroke();
        ctx.lineTo(xOf(n-1),pad.top+cH); ctx.lineTo(xOf(0),pad.top+cH); ctx.closePath();
        const g=ctx.createLinearGradient(0,pad.top,0,pad.top+cH);
        g.addColorStop(0,fillColor); g.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=g; ctx.fill();
        data.forEach((v,i)=>{
            ctx.beginPath(); ctx.arc(xOf(i),yOf(v),4,0,Math.PI*2);
            ctx.fillStyle='#fff'; ctx.fill();
            ctx.strokeStyle=lineColor; ctx.lineWidth=2; ctx.stroke();
        });
    }

    drawArea(income, '#22c55e','rgba(34,197,94,0.14)');
    drawArea(expense,'#6366f1','rgba(99,102,241,0.14)');

    // Legend
    const lx=W-pad.right+10, ly=pad.top+10;
    [['#22c55e','Income'],['#6366f1','Expense']].forEach(([c,l],i)=>{
        const y=ly+i*20;
        ctx.fillStyle=c; ctx.fillRect(lx,y,14,3);
        ctx.fillStyle='#6b7280'; ctx.font='11px DM Sans,sans-serif'; ctx.textAlign='left';
        ctx.fillText(l,lx+18,y+4);
    });
}

// ─────────────────────────────────────────────
// 11. TRANSACTIONS
// ─────────────────────────────────────────────
function getTxKey() { return 'vaultsync_tx_'+(currentUser?currentUser.username:'guest'); }
function getTransactions() { return JSON.parse(localStorage.getItem(getTxKey())||'[]'); }
function saveTxLocal(txs) { localStorage.setItem(getTxKey(),JSON.stringify(txs)); }
function loadTransactions() { renderTransactions(getTransactions()); }

function renderTransactions(txs) {
    const tbody=document.getElementById('txBody');
    if (!txs.length) {
        tbody.innerHTML=`<tr><td colspan="5" class="empty-row">No transactions yet. Add one above!</td></tr>`;
        return;
    }
    tbody.innerHTML=txs.map((t,i)=>`
        <tr>
            <td>${t.date}</td>
            <td>${escHtml(t.desc)}</td>
            <td><span class="badge-${t.type}">${t.type}</span></td>
            <td style="color:${t.type==='income'?'var(--green)':'var(--red)'};font-weight:600;">
                ${t.type==='income'?'+':'−'}₹${fmt(t.amount)}
            </td>
            <td><button class="btn-del" onclick="deleteTransaction(${i})">✕ Remove</button></td>
        </tr>`).join('');
}

async function addTransaction() {
    const desc  =document.getElementById('txDesc').value.trim();
    const amount=parseFloat(document.getElementById('txAmount').value);
    const type  =document.getElementById('txType').value;
    const date  =document.getElementById('txDate').value;
    if (!desc||isNaN(amount)||amount<=0||!date){alert('Please fill all fields with valid values.');return;}
    const tx={desc,amount,type,date};
    const txs=getTransactions(); txs.unshift(tx); saveTxLocal(txs); renderTransactions(txs);
    document.getElementById('txDesc').value=''; document.getElementById('txAmount').value='';
    if (currentUser) {
        try {
            await fetch('TransactionServlet',{method:'POST',
                headers:{'Content-Type':'application/x-www-form-urlencoded'},
                body:new URLSearchParams({action:'add',username:currentUser.username,...tx})});
        } catch(_){}
    }
}

function deleteTransaction(index) {
    if (!confirm('Remove this transaction?')) return;
    const txs=getTransactions(); txs.splice(index,1); saveTxLocal(txs); renderTransactions(txs);
}

// ─────────────────────────────────────────────
// 12. BILLS & LOANS
// ─────────────────────────────────────────────
function getBillKey() { return 'vaultsync_bills_'+(currentUser?currentUser.username:'guest'); }
function getBills() { return JSON.parse(localStorage.getItem(getBillKey())||'[]'); }
function saveBillsLocal(b) { localStorage.setItem(getBillKey(),JSON.stringify(b)); }
function loadBills() { renderBills(getBills()); }

function renderBills(bills) {
    const tbody=document.getElementById('billBody');
    if (!bills.length){
        tbody.innerHTML=`<tr><td colspan="6" class="empty-row">No bills or loans added yet.</td></tr>`;
        return;
    }
    const today=new Date(); today.setHours(0,0,0,0);
    tbody.innerHTML=bills.map((b,i)=>{
        const diff=Math.ceil((new Date(b.due)-today)/86400000);
        const status=diff<0?'Overdue':diff<=5?'Due Soon':'Upcoming';
        const color =diff<0?'var(--red)':diff<=5?'var(--orange)':'var(--green)';
        return `<tr>
            <td>${escHtml(b.name)}</td>
            <td><span class="badge-${b.type==='loan'?'expense':'income'}">${b.type}</span></td>
            <td>₹${fmt(b.amount)}</td>
            <td>${b.due}</td>
            <td><span style="color:${color};font-weight:600;">${status}</span></td>
            <td><button class="btn-del" onclick="deleteBill(${i})">✕</button></td>
        </tr>`;
    }).join('');
}

async function addBill() {
    const name  =document.getElementById('billName').value.trim();
    const amount=parseFloat(document.getElementById('billAmount').value);
    const type  =document.getElementById('billType').value;
    const due   =document.getElementById('billDue').value;
    if (!name||isNaN(amount)||amount<=0||!due){alert('Fill all bill fields with valid values.');return;}
    const bill={name,amount,type,due};
    const bills=getBills(); bills.unshift(bill); saveBillsLocal(bills); renderBills(bills);
    document.getElementById('billName').value=''; document.getElementById('billAmount').value='';
    if (currentUser) {
        try {
            await fetch('BillServlet',{method:'POST',
                headers:{'Content-Type':'application/x-www-form-urlencoded'},
                body:new URLSearchParams({action:'add',username:currentUser.username,...bill})});
        } catch(_){}
    }
}

function deleteBill(index) {
    if (!confirm('Remove this bill/loan?')) return;
    const bills=getBills(); bills.splice(index,1); saveBillsLocal(bills); renderBills(bills);
}

// ─────────────────────────────────────────────
// 13. ANALYSIS CHARTS
// ─────────────────────────────────────────────
function drawAnalysisCharts() {
    const txs    =getTransactions();
    const income =txs.filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0);
    const expense=txs.filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0);
    drawBarChart('incomeExpenseChart',['Income','Expense'],[income||680000,expense||259200],['#22c55e','#ef4444']);
    drawDonutChart('spendingChart');
    drawTrendChart('trendChart');
}

function drawBarChart(id,labels,values,colors) {
    const canvas=document.getElementById(id); if(!canvas)return;
    const W=canvas.parentElement.clientWidth||400, H=240;
    canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,W,H);
    const pad={top:28,right:20,bottom:40,left:62};
    const cW=W-pad.left-pad.right, cH=H-pad.top-pad.bottom;
    const maxV=Math.max(...values)*1.2;
    const barW=Math.min(70,(cW/labels.length)*0.5);
    const gap=(cW-barW*labels.length)/(labels.length+1);
    ctx.strokeStyle='#f3f4f6'; ctx.lineWidth=1;
    for(let g=0;g<=4;g++){
        const y=pad.top+(cH/4)*g;
        ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(W-pad.right,y);ctx.stroke();
        ctx.fillStyle='#9ca3af';ctx.font='10px DM Sans,sans-serif';ctx.textAlign='right';
        ctx.fillText('₹'+shortNum(Math.round(maxV*(1-g/4))),pad.left-6,y+4);
    }
    values.forEach((v,i)=>{
        const x=pad.left+gap*(i+1)+barW*i, h=(v/maxV)*cH, y=pad.top+cH-h;
        const gr=ctx.createLinearGradient(0,y,0,y+h);
        gr.addColorStop(0,colors[i]); gr.addColorStop(1,colors[i]+'55');
        ctx.fillStyle=gr; ctx.beginPath(); ctx.roundRect(x,y,barW,h,[6,6,0,0]); ctx.fill();
        ctx.fillStyle=colors[i];ctx.font='11px DM Sans,sans-serif';ctx.textAlign='center';
        ctx.fillText('₹'+shortNum(v),x+barW/2,y-6);
        ctx.fillStyle='#6b7280'; ctx.fillText(labels[i],x+barW/2,H-10);
    });
}

function drawDonutChart(id) {
    const canvas=document.getElementById(id); if(!canvas)return;
    const W=canvas.parentElement.clientWidth||400, H=240;
    canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,W,H);
    const cx=W*0.38, cy=H/2, rO=82, rI=46;
    const slices=[
        {label:'Housing',pct:35,color:'#3b82f6'},
        {label:'Food',   pct:25,color:'#22c55e'},
        {label:'Utility',pct:15,color:'#f97316'},
        {label:'Travel', pct:15,color:'#a855f7'},
        {label:'Other',  pct:10,color:'#64748b'}
    ];
    let angle=-Math.PI/2;
    slices.forEach(s=>{
        const sweep=(s.pct/100)*Math.PI*2;
        ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,rO,angle,angle+sweep);ctx.closePath();
        ctx.fillStyle=s.color;ctx.fill();
        ctx.beginPath();ctx.arc(cx,cy,rI,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();
        angle+=sweep;
    });
    ctx.fillStyle='#1a1f2e';ctx.font='bold 14px Syne,sans-serif';ctx.textAlign='center';
    ctx.fillText('Expense',cx,cy-2);
    ctx.font='11px DM Sans,sans-serif';ctx.fillStyle='#9ca3af';ctx.fillText('Breakdown',cx,cy+14);
    const lx=cx+rO+18;
    slices.forEach((s,i)=>{
        const ly=H/2-(slices.length*22)/2+i*24;
        ctx.fillStyle=s.color;ctx.beginPath();ctx.roundRect(lx,ly,12,12,3);ctx.fill();
        ctx.fillStyle='#374151';ctx.font='12px DM Sans,sans-serif';ctx.textAlign='left';
        ctx.fillText(`${s.label}  ${s.pct}%`,lx+18,ly+10);
    });
}

function drawTrendChart(id) {
    const canvas=document.getElementById(id); if(!canvas)return;
    const W=canvas.parentElement.clientWidth||700, H=190;
    canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,W,H);
    const labels=['Oct','Nov','Dec','Jan','Feb','Mar','Apr'];
    const savings=[88000,112000,95000,124000,133000,108000,114286];
    const income =[640000,660000,705000,720000,670000,690000,680000];
    const pad={top:24,right:120,bottom:32,left:64};
    const cW=W-pad.left-pad.right, cH=H-pad.top-pad.bottom, n=labels.length;
    const maxV=Math.max(...income)*1.15;
    const xOf=i=>pad.left+(i/(n-1))*cW;
    const yOf=v=>pad.top+cH-(v/maxV)*cH;
    ctx.strokeStyle='#e5e7eb';ctx.lineWidth=1;
    for(let g=0;g<=4;g++){
        const y=pad.top+(cH/4)*g;
        ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(W-pad.right,y);ctx.stroke();
        ctx.fillStyle='#9ca3af';ctx.font='10px DM Sans,sans-serif';ctx.textAlign='right';
        ctx.fillText('₹'+shortNum(Math.round(maxV*(1-g/4))),pad.left-6,y+4);
    }
    labels.forEach((l,i)=>{
        ctx.fillStyle='#9ca3af';ctx.textAlign='center';ctx.font='11px DM Sans,sans-serif';
        ctx.fillText(l,xOf(i),H-6);
    });
    function line(data,color){
        ctx.beginPath();
        data.forEach((v,i)=>{
            const x=xOf(i),y=yOf(v);
            if(i===0){ctx.moveTo(x,y);return;}
            const px=xOf(i-1),py=yOf(data[i-1]),cpx=(px+x)/2;
            ctx.bezierCurveTo(cpx,py,cpx,y,x,y);
        });
        ctx.strokeStyle=color;ctx.lineWidth=2.2;ctx.stroke();
        data.forEach((v,i)=>{
            ctx.beginPath();ctx.arc(xOf(i),yOf(v),3.5,0,Math.PI*2);
            ctx.fillStyle='#fff';ctx.fill();
            ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();
        });
    }
    line(income,'#3b82f6'); line(savings,'#22c55e');
    const lx=W-pad.right+12, ly=pad.top+6;
    [['#3b82f6','Income'],['#22c55e','Savings']].forEach(([c,l],i)=>{
        const y=ly+i*20;
        ctx.fillStyle=c;ctx.fillRect(lx,y,14,3);
        ctx.fillStyle='#6b7280';ctx.font='11px DM Sans,sans-serif';ctx.textAlign='left';
        ctx.fillText(l,lx+18,y+5);
    });
}

// ─────────────────────────────────────────────
// 14. UTILITY HELPERS
// ─────────────────────────────────────────────
function fmt(n) { return Number(n).toLocaleString('en-IN'); }

function shortNum(n) {
    if (n>=10000000) return (n/10000000).toFixed(1)+'Cr';
    if (n>=100000)   return (n/100000).toFixed(0)+'L';
    if (n>=1000)     return (n/1000).toFixed(0)+'K';
    return String(n);
}

function escHtml(s) {
    const d=document.createElement('div'); d.textContent=s; return d.innerHTML;
}

function setTodayDate() {
    const today=new Date().toISOString().slice(0,10);
    ['txDate','billDue'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=today;});
}
