let bills = [];
let currentBillId = null;
let deleteMode = false;
let selectedBills = [];

// RENDER
function renderBills(list = bills) {
  let container = document.getElementById("billsList");
  container.innerHTML = "";

  list.forEach(b => {
    container.innerHTML += `
      <div class="bill ${selectedBills.includes(b.id) ? "selected" : ""}" 
           onclick="${deleteMode ? `selectBill(${b.id})` : ""}">

        <div>
          <strong>${b.name}</strong><br>
          <small>Due: ${b.due}</small>
        </div>

        <div>
          ₹${b.amount}<br>
          ${!deleteMode ? `<button class="pay-btn" onclick="event.stopPropagation(); openPayModal(${b.id})">Pay Now</button>` : ""}
        </div>

      </div>
    `;
  });
}

// ADD BILL
function openAddModal() {
  document.getElementById("addModal").classList.remove("hidden");
}

function closeAddModal() {
  document.getElementById("addModal").classList.add("hidden");
}

function addBill() {
  let name = document.getElementById("billName").value;
  let amount = Number(document.getElementById("billAmount").value);
  let date = document.getElementById("billDate").value;

  if (!name || !amount || !date) return alert("Fill all fields");

  bills.push({
    id: Date.now(),
    name,
    amount,
    due: date
  });

  closeAddModal();
  renderBills();
}

// PAY
function openPayModal(id) {
  currentBillId = id;
  let bill = bills.find(b => b.id === id);

  document.getElementById("rangeInfo").innerText =
    `Min: ₹1 | Max: ₹${bill.amount}`;

  document.getElementById("payModal").classList.remove("hidden");
}

function closePayModal() {
  document.getElementById("payModal").classList.add("hidden");
}

function confirmPayment() {
  let pay = Number(document.getElementById("payAmount").value);
  let bill = bills.find(b => b.id === currentBillId);

  if (!bill || pay <= 0 || pay > bill.amount) return alert("Invalid");

  bill.amount -= pay;

  if (bill.amount === 0) {
    bills = bills.filter(b => b.id !== bill.id);
  }

  closePayModal();
  renderBills();
}

// DELETE MODE
function toggleDeleteMode() {
  deleteMode = !deleteMode;
  selectedBills = [];

  document.getElementById("deleteSelectedBtn").classList.toggle("hidden");

  renderBills();
}

function selectBill(id) {
  if (selectedBills.includes(id)) {
    selectedBills = selectedBills.filter(b => b !== id);
  } else {
    selectedBills.push(id);
  }
  renderBills();
}

function deleteSelected() {
  bills = bills.filter(b => !selectedBills.includes(b.id));
  selectedBills = [];
  toggleDeleteMode();
}

// SEARCH
function searchBills() {
  let q = document.getElementById("searchInput").value.toLowerCase();

  let filtered = bills.filter(b =>
    b.name.toLowerCase().includes(q)
  );

  renderBills(filtered);
}
