// Sample placeholders (replace with DB data later)
const bills = [
  { title: "Item 1", due: "Date", amount: "Amount" },
  { title: "Item 2", due: "Date", amount: "Amount" }
];

const loans = [
  {
    name: "Account 1",
    progress: 60,
    monthly: "Amount"
  },
  {
    name: "Account 2",
    progress: 30,
    monthly: "Amount"
  }
];

// Render Bills
const billsContainer = document.getElementById("billsList");

bills.forEach(bill => {
  const div = document.createElement("div");
  div.className = "bill-item";

  div.innerHTML = `
    <div class="bill-info">
      <strong>${bill.title}</strong>
      <span>Due: ${bill.due}</span>
    </div>
    <div class="bill-actions">
      <span>${bill.amount}</span>
      <button>Pay Now</button>
    </div>
  `;

  billsContainer.appendChild(div);
});

// Render Loans
const loansContainer = document.getElementById("loansList");

loans.forEach(loan => {
  const div = document.createElement("div");
  div.className = "loan-item";

  div.innerHTML = `
    <div class="loan-top">
      <strong>${loan.name}</strong>
      <span>Remaining</span>
    </div>

    <div class="progress">
      <div class="progress-bar" style="width:${loan.progress}%"></div>
    </div>

    <div class="loan-bottom">
      <span>Monthly: ${loan.monthly}</span>
      <button>Extra Payment</button>
    </div>
  `;

  loansContainer.appendChild(div);
});