/* =============================================
   VaultSync — bills.js
   Bills: urgency color coding, pay full/partial
   Loans: EMI, advance (2-6 months), custom
   Both reflect payments back in dashboard stats
============================================= */

var activeBillIndex = null;
var activeLoanIndex = null;

// ── LOAD & RENDER BILLS ───────────────────────
function loadBills() {
  var bills = getBillData();
  var body  = document.getElementById('billsList');
  var sub   = document.getElementById('billsSubtitle');

  if (!bills.length) {
    body.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:16px 0">No bills added yet. Click "+ Add Bill" to get started.</p>';
    sub.textContent = 'No bills added yet.';
    return;
  }

  var due = bills.filter(function(b){ return daysUntil(b.due) >= 0; }).length;
  sub.textContent = 'You have ' + due + ' bill' + (due===1?'':' s') + ' due soon.';

  body.innerHTML = bills.map(function(b,i){
    var days = daysUntil(b.due);
    var urgency = days < 0 ? 'urgent' : days <= 5 ? 'soon' : 'ok';
    var dueLabel = days < 0
      ? 'Overdue by ' + Math.abs(days) + ' day(s)'
      : 'Due: ' + formatDisplayDate(b.due);
    var autopay = b.autopay
      ? '<span class="autopay-badge">AUTOPAY</span>' : '';

    return '<div class="bill-item '+urgency+'">' +
      '<div class="bill-clock">⏰</div>' +
      '<div class="bill-info">' +
        '<div class="bill-name">'+escH(b.name)+autopay+'</div>' +
        '<div class="bill-due">'+dueLabel+'</div>' +
      '</div>' +
      '<div>' +
        '<div class="bill-amount">₹'+parseFloat(b.amount).toLocaleString('en-IN',{minimumFractionDigits:2})+'</div>' +
        (days >= 0
          ? '<button class="pay-btn" onclick="openPayBill('+i+')">Pay Now</button>'
          : '<button class="pay-btn" style="background:#6b7280" onclick="openPayBill('+i+')">Pay Overdue</button>') +
      '</div>' +
    '</div>';
  }).join('');
}

// ── ADD BILL ──────────────────────────────────
async function addBill() {
  var name    = document.getElementById('billName').value.trim();
  var amt     = parseFloat(document.getElementById('billAmt').value);
  var due     = document.getElementById('billDue').value;
  var autopay = document.getElementById('billAutopay').checked;

  if (!name||isNaN(amt)||amt<=0||!due) { alert('Please fill all bill fields.'); return; }

  var bills = getBillData();
  bills.push({ name:name, amount:amt, due:due, autopay:autopay });
  saveBillData(bills);
  loadBills();
  closeModal('addBillModal');
  // reset
  document.getElementById('billName').value='';
  document.getElementById('billAmt').value='';
  document.getElementById('billDue').value=todayStr();
  document.getElementById('billAutopay').checked=false;

  if (currentUser) {
    try {
      await fetch('BillServlet',{
        method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({action:'add',username:currentUser.username,name:name,amount:amt,due:due,autopay:autopay})
      });
    } catch(e){}
  }
}

// ── PAY BILL ──────────────────────────────────
function openPayBill(index) {
  activeBillIndex = index;
  var bills = getBillData();
  var b     = bills[index];
  document.getElementById('payBillName').textContent = b.name;
  document.getElementById('payBillDue').textContent  = '₹' + parseFloat(b.amount).toLocaleString('en-IN',{minimumFractionDigits:2});
  document.getElementById('payBillAmt').value        = b.amount;
  openModal('payBillModal');
}

async function submitBillPayment() {
  var bills  = getBillData();
  var b      = bills[activeBillIndex];
  var payAmt = parseFloat(document.getElementById('payBillAmt').value);

  if (isNaN(payAmt)||payAmt<=0) { alert('Enter a valid payment amount.'); return; }
  if (payAmt > b.amount) { alert('Payment cannot exceed the bill amount of ₹'+fmt(b.amount)); return; }

  // Deduct from balance in stats
  deductFromBalance(payAmt, 'Bill payment: ' + b.name);

  if (payAmt >= b.amount) {
    // Full payment — remove bill
    bills.splice(activeBillIndex, 1);
  } else {
    // Partial — reduce amount
    bills[activeBillIndex].amount = b.amount - payAmt;
  }

  saveBillData(bills);
  loadBills();
  closeModal('payBillModal');
  alert('Payment of ₹' + fmt(payAmt) + ' recorded. Your balance has been updated.');
}

// ── LOAD & RENDER LOANS ───────────────────────
function loadLoans() {
  var loans = getLoanData();
  var body  = document.getElementById('loansList');
  var total = loans.reduce(function(s,l){ return s+(l.total-l.paid); },0);
  document.getElementById('totalOutstanding').textContent = '₹' + fmt(total);

  if (!loans.length) {
    body.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:16px 0">No loans added yet. Click "+ Add Loan" to get started.</p>';
    return;
  }

  body.innerHTML = loans.map(function(l,i){
    var remaining  = Math.max(0, l.total - l.paid);
    var paidPct    = l.total>0 ? Math.round((l.paid/l.total)*100) : 0;
    var paidFmt    = '₹' + fmt(l.paid);
    return '<div class="loan-item">' +
      '<div class="loan-top">' +
        '<div><div class="loan-name">'+escH(l.name)+'</div>' +
          '<div class="loan-sub">'+l.apr+'% APR &nbsp;·&nbsp; Next payment: '+formatDisplayDate(l.next)+'</div></div>' +
        '<div><div class="loan-remaining">₹'+fmt(remaining)+'</div>' +
          '<div class="loan-sub">Remaining</div></div>' +
      '</div>' +
      '<div class="loan-progress"><div class="loan-progress-fill" style="width:'+paidPct+'%"></div></div>' +
      '<div class="loan-progress-row">' +
        '<span>'+paidPct+'% Paid ('+paidFmt+')</span>' +
        '<span>₹'+fmt(l.total)+' Total</span>' +
      '</div>' +
      '<div class="loan-actions">' +
        '<div class="loan-emi-info">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>' +
          'Monthly: ₹'+fmt(l.emi)+
        '</div>' +
        '<button class="btn-extra" onclick="openPayLoan('+i+')">Make Extra Payment</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ── ADD LOAN ──────────────────────────────────
async function addLoan() {
  var name  = document.getElementById('loanName').value.trim();
  var total = parseFloat(document.getElementById('loanTotal').value);
  var apr   = parseFloat(document.getElementById('loanApr').value);
  var emi   = parseFloat(document.getElementById('loanEmi').value);
  var paid  = parseFloat(document.getElementById('loanPaid').value)||0;
  var next  = document.getElementById('loanNext').value;

  if (!name||isNaN(total)||isNaN(emi)||!next) { alert('Please fill all loan fields.'); return; }

  var loans = getLoanData();
  loans.push({ name:name, total:total, apr:apr, emi:emi, paid:paid, next:next });
  saveLoanData(loans);
  loadLoans();
  closeModal('addLoanModal');
  ['loanName','loanTotal','loanApr','loanEmi'].forEach(function(id){ document.getElementById(id).value=''; });
  document.getElementById('loanPaid').value='0';
  document.getElementById('loanNext').value=todayStr();

  if (currentUser) {
    try {
      await fetch('LoanServlet',{
        method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({action:'add',username:currentUser.username,
          name:name,total:total,apr:apr,emi:emi,paid:paid,next:next})
      });
    } catch(e){}
  }
}

// ── PAY LOAN ──────────────────────────────────
function openPayLoan(index) {
  activeLoanIndex = index;
  var loans = getLoanData();
  var l     = loans[index];
  document.getElementById('payLoanName').textContent      = l.name;
  document.getElementById('payLoanRemaining').textContent = '₹' + fmt(Math.max(0, l.total - l.paid));
  document.getElementById('payLoanEmi').textContent       = '₹' + fmt(l.emi);
  document.getElementById('payLoanType').value            = 'emi';
  document.getElementById('payLoanAmt').value             = l.emi;
  openModal('payLoanModal');
}

function updateLoanPayAmt() {
  var loans = getLoanData();
  var l     = loans[activeLoanIndex];
  var type  = document.getElementById('payLoanType').value;
  var months = { emi:1, advance2:2, advance3:3, advance4:4, advance6:6 };
  if (type === 'custom') {
    document.getElementById('payLoanAmt').removeAttribute('readonly');
    return;
  }
  document.getElementById('payLoanAmt').value = l.emi * (months[type]||1);
  document.getElementById('payLoanAmt').setAttribute('readonly','readonly');
}

async function submitLoanPayment() {
  var loans  = getLoanData();
  var l      = loans[activeLoanIndex];
  var payAmt = parseFloat(document.getElementById('payLoanAmt').value);
  var remaining = l.total - l.paid;

  if (isNaN(payAmt)||payAmt<=0) { alert('Enter a valid payment amount.'); return; }
  if (payAmt > remaining) { alert('Payment ₹'+fmt(payAmt)+' exceeds remaining ₹'+fmt(remaining)+'. Adjusted.'); payAmt = remaining; }

  loans[activeLoanIndex].paid += payAmt;

  // Advance next due date by months paid
  var monthsPaid = Math.round(payAmt / l.emi);
  if (monthsPaid > 0) {
    var nextDate = new Date(l.next+'T00:00:00');
    nextDate.setMonth(nextDate.getMonth() + monthsPaid);
    loans[activeLoanIndex].next = nextDate.toISOString().slice(0,10);
  }

  // If fully paid, keep but mark complete
  if (loans[activeLoanIndex].paid >= l.total) {
    loans[activeLoanIndex].paid = l.total;
  }

  saveLoanData(loans);
  deductFromBalance(payAmt, 'Loan payment: ' + l.name);
  loadLoans();
  closeModal('payLoanModal');
  document.getElementById('payLoanAmt').removeAttribute('readonly');
  alert('Payment of ₹' + fmt(payAmt) + ' recorded. Balance updated.');
}

// ── DEDUCT FROM BALANCE & REFLECT ON DASHBOARD ──
function deductFromBalance(amount, note) {
  var raw = localStorage.getItem(statsKey());
  if (!raw) return;
  var s = JSON.parse(raw);
  s.balance = Math.max(0, (s.balance||0) - amount);
  s.expense  = (s.expense||0) + amount;
  localStorage.setItem(statsKey(), JSON.stringify(s));
  // Live update overview cards if visible
  renderStats(s);
  // Log as expense transaction automatically
  var txs = getTxData();
  txs.unshift({
    id:'T'+(txs.length+1), name:note, type:'expense', category:'Bills & Loans',
    amount:amount, date:todayStr(), status:'completed'
  });
  saveTxData(txs);
}

// ── UTILITY ───────────────────────────────────
function daysUntil(dateStr) {
  var today = new Date(); today.setHours(0,0,0,0);
  var due   = new Date(dateStr+'T00:00:00');
  return Math.ceil((due-today)/86400000);
}
