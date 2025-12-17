// =========================
// DASHBOARD FUNCIONÁRIO
// =========================

let piscinaSelecionada = null;

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "../index.html";
    return;
  }

  try {
    const docSnap = await db.collection("users").doc(user.uid).get();

    if (!docSnap.exists) {
      alert("Perfil não encontrado. Faça login novamente.");
      window.location.href = "../index.html";
      return;
    }

    const data = docSnap.data();
    const role = (data.role || "").toUpperCase();

    if (role !== "FUNCIONARIO") {
      alert("Você não tem permissão para acessar este painel.");
      window.location.href = "../index.html";
      return;
    }

    console.log("Dashboard FUNC: login OK para", data.nome || user.email);

    // Carrega piscinas deste funcionário
    carregarPiscinasFuncionario(user.uid);

    // Monitora emergências deste funcionário
    monitorEmergenciasFuncionario(user.uid);

    carregarNotificacoesFuncionario(user.uid);

  } catch (err) {
    console.error("Erro ao carregar dashboard FUNC:", err);
    alert("Erro ao carregar painel do funcionário. Veja o console.");
  }
});

// =========================
// CARREGAR PISCINAS DO FUNCIONÁRIO
// =========================

function carregarPiscinasFuncionario(funcUid) {
  const lista = document.getElementById("listaMinhasPiscinas");
  const msgSem = document.getElementById("semPiscinasFunc");

  if (!lista || !msgSem) {
    console.warn("Elementos da lista de piscinas não encontrados.");
    return;
  }

  db.collection("piscinas")
    .where("responsavelId", "==", funcUid)
    .onSnapshot(
      (snapshot) => {
        lista.innerHTML = "";

        if (snapshot.empty) {
          msgSem.style.display = "block";
          return;
        }

        msgSem.style.display = "none";

        const docs = [];
        snapshot.forEach((doc) => {
          docs.push({ id: doc.id, ...doc.data() });
        });

        docs.sort((a, b) =>
          (a.clienteNome || "").localeCompare(b.clienteNome || "")
        );

        docs.forEach((d) => {
          const prox = d.proximaVisita || "sem data";

          const li = document.createElement("li");
          li.innerHTML = `
            <strong>${d.clienteNome || "Sem nome"}</strong><br>
            Endereço: ${d.endereco || "-"}<br>
            Volume: ${d.volume || "-"} litros<br>
            Próxima visita: ${prox}<br>
            <button data-id="${d.id}" data-nome="${d.clienteNome || "Cliente"}" class="btn-visita">
              Registrar visita
            </button>
          `;
          lista.appendChild(li);
        });

        // Botões "Registrar visita" -> abre a seção de visitas
        lista.querySelectorAll(".btn-visita").forEach((btn) => {
          btn.addEventListener("click", () => {
            const piscinaId = btn.getAttribute("data-id");
            const clienteNome = btn.getAttribute("data-nome");
            selecionarPiscinaParaVisita(piscinaId, clienteNome);
          carregarLembretesDaPiscina(piscinaId);
         });
        });
      },
      (err) => {
        console.error("Erro ao carregar piscinas do funcionário:", err);
        msgSem.textContent = "Erro ao carregar piscinas. Veja o console.";
        msgSem.style.display = "block";
      }
    );
}

// =========================
// SELECIONAR PISCINA PARA VISITA
// =========================

function selecionarPiscinaParaVisita(piscinaId, clienteNome) {
  piscinaSelecionada = { id: piscinaId, clienteNome };

  const secao = document.getElementById("secao-visitas");
  if (secao) {
    secao.style.display = "block";
  }

  const inputId = document.getElementById("visita-piscina-id");
  if (inputId) {
    inputId.value = piscinaId;
  }

  const titulo = document.getElementById("titulo-visitas");
  if (titulo) {
    titulo.textContent = `Visitas - ${clienteNome || "Cliente"}`;
  }

  carregarVisitas(piscinaId);
}

// =========================
// MONITORAR EMERGÊNCIAS - FUNCIONÁRIO
// =========================

function monitorEmergenciasFuncionario(funcUid) {
  const lista = document.getElementById("listaEmergFunc");
  const msg = document.getElementById("msgEmergFunc");
  const badge = document.getElementById("badgeEmergFunc");

  if (!lista || !msg || !badge) {
    console.warn("Elementos de emergências (FUNC) não encontrados.");
    return;
  }

  db.collection("emergencias")
    .where("status", "==", "ABERTA")
    .where("responsavelId", "==", funcUid)
    .orderBy("criadaEm", "desc")
    .onSnapshot(
      (snapshot) => {
        lista.innerHTML = "";

        const total = snapshot.size;

        if (total === 0) {
          msg.textContent = "Nenhuma emergência aberta para você.";
          msg.style.display = "block";
          badge.textContent = "";
          badge.style.display = "none";
          return;
        }

        msg.style.display = "none";
        badge.textContent = total;
        badge.style.display = "inline-block";

        snapshot.forEach((doc) => {
          const d = doc.data();
          const criada = d.criadaEm ? d.criadaEm.toDate() : null;

          let dataTxt = "-";
          if (criada instanceof Date && !isNaN(criada)) {
            const dia = String(criada.getDate()).padStart(2, "0");
            const mes = String(criada.getMonth() + 1).padStart(2, "0");
            const ano = criada.getFullYear();
            dataTxt = `${dia}/${mes}/${ano}`;
          }

          const li = document.createElement("li");
          li.innerHTML = `
            <strong>${d.tipo || "Emergência"}</strong><br>
            Cliente: ${d.clienteNome || "-"}<br>
            Piscina: ${d.piscinaNome || "-"}<br>
            Data: ${dataTxt}<br>
            Obs: ${d.descricao || "-"}
          `;
          lista.appendChild(li);
        });
      },
      (err) => {
        console.error("Erro ao ouvir emergências (FUNC):", err);
        msg.textContent = "Erro ao carregar emergências. Veja o console.";
        msg.style.display = "block";
        badge.textContent = "";
        badge.style.display = "none";
      }
    );
}

// =========================
// FORMULÁRIO DE VISITA
// =========================

const formVisita = document.getElementById("form-visita");

if (formVisita) {
  formVisita.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const piscinaId = document.getElementById("visita-piscina-id").value;
      const dataVisita = document.getElementById("visita-data").value;
      const produtos = document.getElementById("visita-produtos").value.trim();
      const observacoes = document.getElementById("visita-observacoes").value.trim();
      const proxima = document.getElementById("visita-proxima").value;

      if (!piscinaId) {
        alert("Selecione uma piscina antes de registrar a visita.");
        return;
      }

      if (!dataVisita) {
        alert("Preencha a data da visita.");
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        alert("Usuário não autenticado.");
        return;
      }

      const visitaData = {
        dataHora: new Date(dataVisita),
        produtosUsados: produtos || null,
        observacoes: observacoes || null,
        proximaVisita: proxima ? new Date(proxima) : null,
        funcionarioId: user.uid,
        criadoEm: new Date()
      };

      await db
        .collection("piscinas")
        .doc(piscinaId)
        .collection("visitas")
        .add(visitaData);

      // opcional: atualizar próximo visita também na piscina
      if (proxima) {
        await db.collection("piscinas").doc(piscinaId).update({
          proximaVisita: proxima
        });
      }

      alert("Visita registrada com sucesso! ✅");

      document.getElementById("visita-produtos").value = "";
      document.getElementById("visita-observacoes").value = "";
      document.getElementById("visita-proxima").value = "";

      carregarVisitas(piscinaId);

    } catch (erro) {
      console.error("Erro ao salvar visita:", erro);
      alert("Erro ao salvar visita. Veja o console.");
    }
  });
}

function carregarLembretesDaPiscina(piscinaId) {
  const box = document.getElementById("boxLembretesPiscina");
  const ul  = document.getElementById("listaLembretesPiscina");

  if (!box || !ul) return;

  ul.innerHTML = "Carregando...";

  db.collection("piscinas")
    .doc(piscinaId)
    .get()
    .then((docSnap) => {
      if (!docSnap.exists) {
        ul.innerHTML = "<li>Erro ao carregar lembretes.</li>";
        return;
      }

      const data = docSnap.data();
      const lembretes = (data.lembretes || []).filter(l => l.ativo);

      if (lembretes.length === 0) {
        box.style.display = "none"; // esconde o card
        return;
      }

      box.style.display = "block"; // mostra o card

      ul.innerHTML = "";
      lembretes.forEach((l) => {
        ul.innerHTML += `
          <li>
            <strong>${l.texto}</strong>
            <br><span class="muted">Criado em: ${
              l.criadoEm?.toDate
                ? l.criadoEm.toDate().toLocaleDateString()
                : "--"
            }</span>
          </li>
        `;
      });
    });
}

// =========================
// CARREGAR VISITAS DA PISCINA
// =========================

async function carregarVisitas(piscinaId) {
  const lista = document.getElementById("lista-visitas");
  if (!lista) return;

  lista.innerHTML = "<p>Carregando visitas...</p>";

  try {
    const snap = await db
      .collection("piscinas")
      .doc(piscinaId)
      .collection("visitas")
      .orderBy("dataHora", "desc")
      .get();

    if (snap.empty) {
      lista.innerHTML = "<p>Nenhuma visita registrada ainda.</p>";
      return;
    }

    let html = "";

    snap.forEach((doc) => {
      const v = doc.data();

      const data = v.dataHora
        ? new Date(v.dataHora.seconds ? v.dataHora.seconds * 1000 : v.dataHora).toLocaleString()
        : "Data não informada";

      const prox = v.proximaVisita
        ? new Date(v.proximaVisita.seconds ? v.proximaVisita.seconds * 1000 : v.proximaVisita).toLocaleDateString()
        : "—";

      html += `
        <div class="card-visita" style="border: 1px solid #ddd; padding: 8px; margin-bottom: 8px;">
          <strong>Data:</strong> ${data}<br>
          <strong>Produtos:</strong> ${v.produtosUsados || "—"}<br>
          <strong>Observações:</strong> ${v.observacoes || "—"}<br>
          <strong>Próxima visita:</strong> ${prox}
        </div>
      `;
    });

    lista.innerHTML = html;

  } catch (erro) {
    console.error("Erro ao carregar visitas:", erro);
    lista.innerHTML = "<p>Erro ao carregar visitas.</p>";
  }
}
function carregarNotificacoesFuncionario(userId) {
  const card = document.getElementById("cardNotificacoes");
  const lista = document.getElementById("listaNotificacoes");
  if (!card || !lista) return;

  lista.innerHTML = "Carregando...";

  db.collection("piscinas")
    .where("responsavelId", "==", userId)
    .get()
    .then(async (snap) => {
      let notificacoes = [];

      const hoje = new Date();
      hoje.setHours(0,0,0,0);

      for (const doc of snap.docs) {
        const piscina = doc.data();
        const id = doc.id;

        // 📅 Verificar visita atrasada ou do dia
        if (piscina.proximaVisita) {
          const prox = new Date(piscina.proximaVisita);
          prox.setHours(0,0,0,0);

          if (prox < hoje) {
            notificacoes.push(`⚠ Piscina de ${piscina.clienteNome}: visita ATRASADA!`);
          } else if (prox.getTime() === hoje.getTime()) {
            notificacoes.push(`📅 Piscina de ${piscina.clienteNome}: visita HOJE.`);
          }
        }

        // 🔔 Verificar lembretes ativos
        const lembretes = (piscina.lembretes || []).filter(l => l.ativo);
        lembretes.forEach((l) => {
          notificacoes.push(`💡 ${piscina.clienteNome}: ${l.texto}`);
        });
      }

      // 🚨 Verificar emergências do funcionário
      const emerg = await db.collection("emergencias")
        .where("status", "==", "ABERTA")
        .where("responsavelId", "==", userId)
        .get();

      emerg.forEach((doc) => {
        const e = doc.data();
        notificacoes.push(`🚨 Emergência aberta: ${e.tipo} - Cliente ${e.clienteNome}`);
      });

      // Mostrar notificações
      if (notificacoes.length === 0) {
        card.style.display = "none";
        return;
      }

      lista.innerHTML = "";
      notificacoes.forEach((n) => {
        lista.innerHTML += `<li>${n}</li>`;
      });

      card.style.display = "block";
    });
}
