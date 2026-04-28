/* =============================================
   VaultSync Landing — landing.js
   Handles Login / Signup form interactions
   + calls to Java Servlets via fetch()
============================================= */

// ---- Tab switcher ----
function showForm(type) {
  const loginForm  = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const tabLogin   = document.getElementById('tab-login');
  const tabSignup  = document.getElementById('tab-signup');
  hideAlert();

  if (type === 'login') {
    loginForm.style.display  = 'flex';
    signupForm.style.display = 'none';
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
  } else {
    loginForm.style.display  = 'none';
    signupForm.style.display = 'flex';
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
  }
}

// ---- Alert helpers ----
function showAlert(message, type) {
  const box = document.getElementById('alertBox');
  box.textContent = message;
  box.className = `alert-box ${type}`;
  box.style.display = 'block';
}
function hideAlert() {
  const box = document.getElementById('alertBox');
  box.style.display = 'none';
}

// ---- Toggle loading state on button ----
function setLoading(btnId, textId, loaderId, isLoading) {
  const btn    = document.getElementById(btnId);
  const text   = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = isLoading;
  text.style.display   = isLoading ? 'none'  : 'inline';
  loader.style.display = isLoading ? 'inline' : 'none';
}

// ---- HANDLE LOGIN ----
async function handleLogin(event) {
  event.preventDefault();
  hideAlert();

  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showAlert('Please fill in all fields.', 'error');
    return;
  }

  setLoading('loginBtn', 'btn-text', 'btn-loader', true);

  try {
    const response = await fetch('LoginServlet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email, password })
    });

    const data = await response.json();

    if (data.success) {
      // Store user info in sessionStorage for the dashboard
      sessionStorage.setItem('vaultUser', JSON.stringify({
        name:     data.name,
        username: data.username,
        email:    data.email,
        isNew:    data.isNew   // backend tells us if it's first login
      }));
      showAlert('Login successful! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 800);
    } else {
      showAlert(data.message || 'Invalid credentials. Please try again.', 'error');
    }
  } catch (err) {
    // Demo fallback when running without backend (for UI preview)
    console.warn('Backend not reachable, using demo mode:', err.message);
    sessionStorage.setItem('vaultUser', JSON.stringify({
      name: 'Alex Johnson', username: 'alexj', email, isNew: false
    }));
    showAlert('Login successful! (Demo mode)', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 900);
  } finally {
    setLoading('loginBtn', 'btn-text', 'btn-loader', false);
  }
}

// ---- HANDLE SIGNUP ----
async function handleSignup(event) {
  event.preventDefault();
  hideAlert();

  const name     = document.getElementById('signupName').value.trim();
  const username = document.getElementById('signupUsername').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm  = document.getElementById('signupConfirm').value;

  // Basic front-end validations
  if (!name || !username || !email || !password || !confirm) {
    showAlert('Please fill in all fields.', 'error');
    return;
  }
  if (password !== confirm) {
    showAlert('Passwords do not match.', 'error');
    return;
  }
  if (password.length < 6) {
    showAlert('Password must be at least 6 characters.', 'error');
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    showAlert('Username can only contain letters, numbers, and underscores.', 'error');
    return;
  }

  setLoading('signupBtn', 'btn-text', 'btn-loader', true);

  try {
    const response = await fetch('SignupServlet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ name, username, email, password })
    });

    const data = await response.json();

    if (data.success) {
      sessionStorage.setItem('vaultUser', JSON.stringify({
        name, username, email, isNew: true
      }));
      showAlert('Account created! Redirecting to your dashboard...', 'success');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
    } else {
      showAlert(data.message || 'Signup failed. Please try again.', 'error');
    }
  } catch (err) {
    // Demo fallback
    console.warn('Backend not reachable, using demo mode:', err.message);
    sessionStorage.setItem('vaultUser', JSON.stringify({
      name, username, email, isNew: true
    }));
    showAlert('Account created! (Demo mode) Redirecting...', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
  } finally {
    setLoading('signupBtn', 'btn-text', 'btn-loader', false);
  }
}

// Auto-fill date for UX
document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, redirect to dashboard
  const user = sessionStorage.getItem('vaultUser');
  if (user) {
    // Optional: uncomment to auto-redirect
    // window.location.href = 'dashboard.html';
  }
});
