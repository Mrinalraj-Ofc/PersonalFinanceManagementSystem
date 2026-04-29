/* =============================================
   VaultSync — transactions.js
   Add, render, filter (type + search + date range),
   export, delete transactions
============================================= */

var txFilter = 'all';

var CATEGORIES = {
  income:  ['Salary','Freelance','Business','Investment','Gift','Other'],
  expense: ['Housing','Food','Utilities','Transport','Healthcare','Education','Entertainment','Shopping','Other'],
  savings: ['Emergency Fund','Investment','Fixed Deposit','SIP/MF','Other']
};

// ── Called when page loads & when switching to Transactions tab ──
function loadTransactions() {
  renderTransactions(getTxData());
}

// ── Update categories dropdown when type changes ──
function updateCategories() {
  var type = document.getElementById('txType').value;
  var sel  = document.getElementById('txCategory');
  sel.innerHTML = '';
  CATEGORIES[type].forEach(function(c){
    var opt = document.createElement('option'); opt.value=c; opt.textContent=c; sel.appendChild(opt);
  });
}
// Init categories on page load
document.addEventListener('DOMContentLoaded', function(){ updateCategories(); });

// ── ADD TRANSACTION ────────────────────────────
async function addTransaction() {
  var name   = document.getElementById('txName').value.trim();
  var type   = document.getElementById('txType').value;
  var cat    = document.getElementById('txCategory').value;
  var amt    = parseFloat(document.getElementById('txAmt').value);
  var date   = document.getElementById('txDate').value;
  var status = document.getElementById('txStatus').value;

  if (!name||isNaN(amt)||amt<=0||!date) { alert('Please fill all fields.'); return; }

  var txs = getTxData();
  var id  = 'T' + (txs.length + 1);

  var tx = { id:id, name:name, type:type, category:cat, amount:amt, date:date, status:status };
  txs.unshift(tx);
  saveTxData(txs);
  renderTransactions(txs);
  closeModal('addTxModal');
  resetTxForm();

  // Push to backend
  if (currentUser) {
    try {
      await fetch('TransactionServlet', {
        method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body: new URLSearchParams({
          action:'add', username:currentUser.username,
          name:name, type:type, category:cat, amount:amt, date:date, status:status
        })
      });
    } catch(e) {}
  }
}

function resetTxForm() {
  ['txName','txAmt'].forEach(function(id){ document.getElementById(id).value=''; });
  document.getElementById('txType').value = 'income';
  updateCategories();
  document.getElementById('txDate').value = todayStr();
  document.getElementById('txStatus').value = 'completed';
  // update day label on modal
  var el = document.getElementById('addTxDay');
  if (el) {
    var now  = new Date();
    var name = currentUser ? currentUser.name.split(' ')[0] : '';
    el.textContent = 'Welcome ' + name + ' — ' +
      now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  }
}

// Also set the day label whenever the modal opens
var origOpenModal = openModal;
function openModal(id) {
  var m = document.getElementById(id);
  if (m) { m.style.display='flex'; m.classList.add('open'); }
  if (id==='addTxModal') {
    var el = document.getElementById('addTxDay');
    if (el) {
      var now  = new Date();
      var nm   = currentUser ? currentUser.name.split(' ')[0] : '';
      el.textContent = 'Welcome ' + nm + ' — ' +
        now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    }
    updateCategories();
  }
}

// ── DELETE ────────────────────────────────────
function deleteTx(index) {
  if (!confirm('Remove this transaction?')) return;
  var txs = getTxData();
  txs.splice(index,1);
  // Reassign IDs
  txs.forEach(function(t,i){ t.id='T'+(i+1); });
  saveTxData(txs);
  applyTxFilters();
}

// ── FILTERS ───────────────────────────────────
function filterTx(el, type) {
  txFilter = type;
  document.querySelectorAll('.tx-tab').forEach(function(t){ t.classList.remove('active'); });
  el.classList.add('active');
  applyTxFilters();
}

function applyTxFilters() {
  var all    = getTxData();
  var search = document.getElementById('txSearch').value.toLowerCase();
  var from   = document.getElementById('txFrom').value;
  var to     = document.getElementById('txTo').value;

  var filtered = all.filter(function(t){
    var matchType   = (txFilter==='all') || (t.type===txFilter);
    var matchSearch = !search ||
      t.name.toLowerCase().includes(search) ||
      t.category.toLowerCase().includes(search);
    var matchFrom = !from || t.date >= from;
    var matchTo   = !to   || t.date <= to;
    return matchType && matchSearch && matchFrom && matchTo;
  });

  renderTransactions(filtered);
}

function clearDateFilter() {
  document.getElementById('txFrom').value = '';
  document.getElementById('txTo').value   = '';
  applyTxFilters();
}

// ── RENDER TABLE ──────────────────────────────
function renderTransactions(txs) {
  var body = document.getElementById('txBody');
  if (!txs.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-row">No transactions found.</td></tr>';
    return;
  }

  body.innerHTML = txs.map(function(t,i){
    // Icon based on type
    var arrow = t.type==='income' ? '↗' : t.type==='savings' ? '$' : '↘';
    var iconClass = t.type;
    // Amount color
    var amtClass  = t.type==='income' ? 'amount-pos' : t.type==='savings' ? 'amount-sav' : 'amount-neg';
    var amtSign   = t.type==='income'||t.type==='savings' ? '+' : '-';
    var amtStr    = amtSign + '₹' + parseFloat(t.amount).toLocaleString('en-IN',{minimumFractionDigits:2});

    return '<tr>' +
      '<td><div class="tx-name-wrap">' +
        '<div class="tx-icon '+iconClass+'">'+arrow+'</div>' +
        '<div><div class="tx-name">'+escH(t.name)+'</div><div class="tx-id">'+t.id+'</div></div>' +
      '</div></td>' +
      '<td><span class="cat-pill">'+escH(t.category)+'</span></td>' +
      '<td>'+formatDisplayDate(t.date)+'</td>' +
      '<td><span class="status-dot"><span class="sdot '+t.status+'"></span>'+t.status+'</span></td>' +
      '<td class="'+amtClass+'">'+amtStr+'</td>' +
      '<td><button class="btn-del" onclick="deleteTx('+i+')">✕</button></td>' +
    '</tr>';
  }).join('');
}

// ── EXPORT CSV ────────────────────────────────
function exportTransactions() {
  var txs = getTxData();
  if (!txs.length) { alert('No transactions to export.'); return; }
  var csv = 'ID,Name,Type,Category,Amount,Date,Status\n';
  txs.forEach(function(t){
    csv += [t.id,'"'+t.name+'"',t.type,t.category,t.amount,t.date,t.status].join(',') + '\n';
  });
  var blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href=url; a.download='VaultSync_Transactions_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click(); URL.revokeObjectURL(url);
}

// ── DATE DISPLAY ──────────────────────────────
function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
}
