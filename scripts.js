const bills = [
  { name: "Bill Name", due: "Date", amount: "Amount", autopay: true },
  { name: "Bill Name", due: "Date", amount: "Amount", autopay: false }
];

const loans = [
  { name: "Loan Name", progress: 65, monthly: "Amount" },
  { name: "Loan Name", progress: 30, monthly: "Amount" }
];

// Bills
const billsContainer = document.getElementById("billsList");

bills.forEach(b => {
  billsContainer.innerHTML += `
    <div class="bill">

      <div class="bill-left">
        <div class="bill-icon">
          <i data-lucide="clock"></i>
        </div>

        <div class="bill-info">
          <strong>${b.name}</strong>
          <small>
            Due: ${b.due}
            ${b.autopay ? '<span class="badge">AUTOPAY</span>' : ''}
          </small>
        </div>
      </div>

      <div>
        <strong>${b.amount}</strong><br>
        <button class="pay-btn">Pay Now</button>
      </div>

    </div>
  `;
});

// Loans
const loansContainer = document.getElementById("loansList");

loans.forEach(l => {
  loansContainer.innerHTML += `
    <div class="loan">

      <div class="loan-top">
        <strong>${l.name}</strong>
        <span>Remaining</span>
      </div>

      <div class="progress">
        <div class="progress-bar" style="width:${l.progress}%"></div>
      </div>

      <div class="loan-bottom">
        <span>Monthly: ${l.monthly}</span>
        <button class="extra-btn">Make Extra Payment</button>
      </div>

    </div>
  `;
});

// render icons
lucide.createIcons();