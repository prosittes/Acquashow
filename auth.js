// auth.js  → login com Firebase + redirecionamento por role

const loginForm = document.getElementById("loginForm");
const loginMsg  = document.getElementById("loginMsg");

async function handleLogin(event) {
  event.preventDefault();

  if (loginMsg) {
    loginMsg.textContent = "Entrando...";
  }

  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    // 1) Login no Firebase Auth
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const user = cred.user;

    // 2) Buscar perfil na coleção "users"
    let docSnap = await db.collection("users").doc(user.uid).get();

    // Se não existir, cria um perfil mínimo automático (CLIENTE)
    if (!docSnap.exists) {
      await db.collection("users").doc(user.uid).set({
        nome: user.email.split("@")[0],
        email: user.email,
        role: "CLIENTE", // padrão; ADM e FUNC vão vir pelo cadastro do ADM
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });

      docSnap = await db.collection("users").doc(user.uid).get();
    }

    const data = docSnap.data();
    const role = (data.role || "").toUpperCase();

    // 3) Redirecionar conforme o papel
    if (role === "ADM") {
      window.location.href = "pages/dashboard-adm.html";
    } else if (role === "FUNCIONARIO") {
      window.location.href = "pages/dashboard-func.html";
    } else if (role === "CLIENTE") {
      window.location.href = "pages/dashboard-cliente.html";
    } else {
      alert("Papel de usuário inválido. Procure o administrador.");
    }

  } catch (error) {
    console.error(error.code, error.message);
    if (loginMsg) {
      loginMsg.textContent = "Erro no login: " + (error.code || error.message);
    } else {
      alert("Erro no login: " + (error.code || error.message));
    }
  }
}

// Só adiciona o listener se o form existir na página
if (loginForm) {
  loginForm.addEventListener("submit", handleLogin);
}
