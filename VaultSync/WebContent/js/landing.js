/* VaultSync Landing — landing.js */

// ── Date greeting on page load ──
document.addEventListener('DOMContentLoaded', () => {
  const now   = new Date();
  const day   = now.toLocaleDateString('en-IN', { weekday: 'long' });
  const date  = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('todayLabel').textContent = day + ', ' + date;
});

// ── Tab switcher ──
function showForm(type) {
  hideAlert();
  const isLogin = (type === 'login');
  document.getElementById('loginForm').style.display  = isLogin ? 'flex' : 'none';
  document.getElementById('signupForm').style.display = isLogin ? 'none' : 'flex';
  document.getElementById('tab-login').classList.toggle('active',  isLogin);
  document.getElementById('tab-signup').classList.toggle('active', !isLogin);
}

// ── Alerts ──
function showAlert(msg, type) {
  var b = document.getElementById('alertBox');
  b.textContent = msg; b.className = 'alert-box ' + type; b.style.display = 'block';
}
function hideAlert() {
  document.getElementById('alertBox').style.display = 'none';
}

// ── Button loading state ──
function setLoading(formId, loading) {
  var btn    = document.getElementById(formId === 'loginForm' ? 'loginBtn' : 'signupBtn');
  btn.disabled = loading;
  btn.querySelector('.btn-text').style.display   = loading ? 'none' : 'inline';
  btn.querySelector('.btn-loader').style.display = loading ? 'inline' : 'none';
}

// ── LOGIN ──
async function handleLogin(event) {
  event.preventDefault();
  hideAlert();
  var email    = document.getElementById('loginEmail').value.trim();
  var password = document.getElementById('loginPassword').value;
  if (!email || !password) { showAlert('Please fill in all fields.', 'error'); return; }

  setLoading('loginForm', true);
  try {
    var res  = await fetch('LoginServlet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email, password })
    });
    var data = await res.json();
    if (data.success) {
      sessionStorage.setItem('vaultUser', JSON.stringify({
        name: data.name, username: data.username, email: data.email, isNew: data.isNew
      }));
      showAlert('Login successful! Redirecting...', 'success');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 700);
    } else {
      showAlert(data.message || 'Invalid credentials.', 'error');
    }
  } catch (err) {
    // Demo fallback (no backend running)
    console.warn('Demo mode:', err.message);
    sessionStorage.setItem('vaultUser', JSON.stringify({
      name: 'Alex Johnson', username: 'alex', email: email, isNew: false
    }));
    showAlert('Login successful! (Demo mode)', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
  } finally {
    setLoading('loginForm', false);
  }
}

// ── SIGNUP ──
async function handleSignup(event) {
  event.preventDefault();
  hideAlert();
  var name     = document.getElementById('signupName').value.trim();
  var username = document.getElementById('signupUsername').value.trim();
  var email    = document.getElementById('signupEmail').value.trim();
  var password = document.getElementById('signupPassword').value;
  var confirm  = document.getElementById('signupConfirm').value;

  if (!name || !username || !email || !password || !confirm) {
    showAlert('Please fill in all fields.', 'error'); return; }
  if (password !== confirm) {
    showAlert('Passwords do not match.', 'error'); return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    showAlert('Username: letters, numbers, underscores only.', 'error'); return; }

  setLoading('signupForm', true);
  try {
    var res  = await fetch('SignupServlet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ name, username, email, password })
    });
    var data = await res.json();
    if (data.success) {
      sessionStorage.setItem('vaultUser', JSON.stringify({
        name, username, email, isNew: true
      }));
      showAlert('Account created! Redirecting...', 'success');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 900);
    } else {
      showAlert(data.message || 'Signup failed.', 'error');
    }
  } catch (err) {
    // Demo fallback
    sessionStorage.setItem('vaultUser', JSON.stringify({ name, username, email, isNew: true }));
    showAlert('Account created! (Demo mode)', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 900);
  } finally {
    setLoading('signupForm', false);
  }
}
