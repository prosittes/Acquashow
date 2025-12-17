// =========================
// DASHBOARD CLIENTE
// =========================

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "../index.html";
    return;
  }

  try {
    // 1) Busca perfil do usuário logado
    const docUser = await db.collection("users").doc(user.uid).get();

    if (!docUser.exists) {
      alert("Perfil não encontrado. Faça login novamente.");
      window.location.href = "../index.html";
      return;
    }

    const dataUser = docUser.data();
    const role = (dataUser.role || "").toUpperCase();

    // Só CLIENTE pode acessar esse painel
    if (role !== "CLIENTE") {
      alert("Você não tem permissão para acessar este painel.");
      window.location.href = "../index.html";
      return;
    }

    // Mostra o nome do cliente no topo (se existir o span)
    const spanTopo = document.getElementById("clienteNomeTopo");
    if (spanTopo) {
      spanTopo.textContent = dataUser.nome || user.email;
    }

    // 2) Buscar piscina(s) desse cliente
    const snapPiscinas = await db
      .collection("piscinas")
      .where("clienteId", "==", user.uid)
      .get();

    if (snapPiscinas.empty) {
      console.warn("Nenhuma piscina encontrada para este cliente.");
      preencherInfoPiscina(null); // limpa/coloca traços
      mostrarHistoricoVazio("Nenhuma visita registrada ainda.");
      configurarEmergencia(null, dataUser, user, null);
      return;
    }

    // Por enquanto vamos pegar a primeira piscina encontrada
    const docPiscina = snapPiscinas.docs[0];
    const piscina = docPiscina.data();
    const piscinaId = docPiscina.id;

    // 3) Preencher informações da piscina na tela
    preencherInfoPiscina(piscina);

    // 4) Carregar histórico de visitas dessa piscina
    carregarHistoricoVisitas(piscinaId);

    // 5) Configurar botão de emergência
    configurarEmergencia(piscinaId, dataUser, user, piscina);

  } catch (err) {
    console.error("Erro ao carregar dashboard do cliente:", err);
    alert("Erro ao carregar informações. Veja o console.");
  }
});

// =========================
// Preencher informações da piscina
// =========================

function preencherInfoPiscina(piscina) {
  const funcionarioNomeEl = document.getElementById("funcionarioNome");
  const enderecoEl        = document.getElementById("enderecoPiscina");
  const volumeEl          = document.getElementById("volumePiscina");
  const proxVisitaEl      = document.getElementById("proximaVisita");
  const topoNomeEl        = document.getElementById("clienteNomeTopo");

  if (!piscina) {
    if (funcionarioNomeEl) funcionarioNomeEl.textContent = "-";
    if (enderecoEl)        enderecoEl.textContent        = "-";
    if (volumeEl)          volumeEl.textContent          = "-";
    if (proxVisitaEl)      proxVisitaEl.textContent      = "-";
    return;
  }

  if (topoNomeEl) {
    topoNomeEl.textContent =
      piscina.clienteCadastroNome ||
      piscina.clienteNome ||
      topoNomeEl.textContent;
  }

  if (funcionarioNomeEl) {
    funcionarioNomeEl.textContent = piscina.responsavelNome || "-";
  }

  if (enderecoEl) {
    enderecoEl.textContent = piscina.endereco || "-";
  }

  if (volumeEl) {
    volumeEl.textContent = piscina.volume
      ? `${piscina.volume} litros`
      : "-";
  }

  if (proxVisitaEl) {
    // pode ser string (yyyy-mm-dd) ou Timestamp
    if (typeof piscina.proximaVisita === "string") {
      proxVisitaEl.textContent = piscina.proximaVisita;
    } else if (
      piscina.proximaVisita &&
      typeof piscina.proximaVisita.toDate === "function"
    ) {
      const d = piscina.proximaVisita.toDate();
      const dia = String(d.getDate()).padStart(2, "0");
      const mes = String(d.getMonth() + 1).padStart(2, "0");
      const ano = d.getFullYear();
      proxVisitaEl.textContent = `${dia}/${mes}/${ano}`;
    } else {
      proxVisitaEl.textContent = "-";
    }
  }
}

// =========================
// Histórico de visitas
// =========================

async function carregarHistoricoVisitas(piscinaId) {
  const corpoTabela = document.getElementById("tabelaHistorico");
  const msgSem = document.getElementById("msgSemVisitas");

  if (!corpoTabela) {
    console.warn("Tabela de histórico não encontrada.");
    return;
  }

  try {
    const snap = await db
      .collection("visitas")
      .where("piscinaId", "==", piscinaId)
      .orderBy("data", "desc")
      .get();

    corpoTabela.innerHTML = "";

    if (snap.empty) {
      mostrarHistoricoVazio("Nenhuma visita registrada ainda.");
      return;
    }

    if (msgSem) msgSem.style.display = "none";

    snap.forEach((doc) => {
      const v = doc.data();

      let dataFormatada = "-";
      if (v.data && typeof v.data.toDate === "function") {
        const d = v.data.toDate();
        const dia = String(d.getDate()).padStart(2, "0");
        const mes = String(d.getMonth() + 1).padStart(2, "0");
        const ano = d.getFullYear();
        dataFormatada = `${dia}/${mes}/${ano}`;
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${dataFormatada}</td>
        <td>${v.funcionarioNome || "-"}</td>
        <td>${v.observacao || "-"}</td>
      `;
      corpoTabela.appendChild(tr);
    });

  } catch (err) {
    console.error("Erro ao carregar histórico de visitas:", err);
    mostrarHistoricoVazio("Erro ao carregar histórico. Veja o console.");
  }
}

function mostrarHistoricoVazio(msg) {
  const corpoTabela = document.getElementById("tabelaHistorico");
  const msgSem = document.getElementById("msgSemVisitas");

  if (corpoTabela) corpoTabela.innerHTML = "";
  if (msgSem) {
    msgSem.textContent = msg;
    msgSem.style.display = "block";
  }
}

// =========================
// Envio de emergência
// =========================

function configurarEmergencia(piscinaId, dataUser, user, piscina) {
  const botoes = document.querySelectorAll(".btnEmergencia");
  const descricaoInput = document.getElementById("descricaoEmergencia");
  const btnEnviar = document.getElementById("btnEnviarEmergencia");
  const statusEl = document.getElementById("statusEmergencia");

  if (!btnEnviar || !botoes.length) {
    console.warn("Elementos de emergência não encontrados.");
    return;
  }

  let tipoSelecionado = null;

  // escolher tipo
  botoes.forEach((btn) => {
    btn.addEventListener("click", () => {
      botoes.forEach((b) => b.classList.remove("ativo"));
      btn.classList.add("ativo");
      tipoSelecionado = btn.dataset.tipo;
    });
  });

  btnEnviar.addEventListener("click", async () => {
    if (!piscinaId) {
      alert("Piscina não carregada. Atualize a página ou fale com o administrador.");
      return;
    }

    if (!tipoSelecionado) {
      alert("Selecione um tipo de emergência.");
      return;
    }

    const descricao = descricaoInput ? descricaoInput.value.trim() : "";

    try {
      await db.collection("emergencias").add({
        piscinaId: piscinaId,
        responsavelId: piscina && piscina.responsavelId ? piscina.responsavelId : null,
        responsavelNome: piscina && piscina.responsavelNome ? piscina.responsavelNome : "",
        clienteUid: user.uid,
        clienteNome: dataUser.nome || user.email,
        tipo: tipoSelecionado,
        descricao: descricao || null,
        status: "ABERTA",
        criadaEm: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (statusEl) {
        statusEl.textContent = "Emergência enviada com sucesso!";
        statusEl.style.color = "green";
      }

      if (descricaoInput) descricaoInput.value = "";
      botoes.forEach((b) => b.classList.remove("ativo"));
      tipoSelecionado = null;

    } catch (err) {
      console.error("Erro ao enviar emergência:", err);
      if (statusEl) {
        statusEl.textContent = "Erro ao enviar emergência. Veja o console.";
        statusEl.style.color = "red";
      }
    }
  });
}
