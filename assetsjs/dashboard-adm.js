// =========================
// VARIÁVEIS GLOBAIS
// =========================
let piscinasCache = [];
let piscinaEmEdicaoId = null;
let piscinaSelecionadaAdm = null;
let lembretesTemp = [];
let visitasExtrasTemp = [];

// =========================
// INICIALIZAÇÃO DO PAINEL
// =========================
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

    if (role !== "ADM") {
      alert("Você não tem permissão para acessar este painel.");
      window.location.href = "../index.html";
      return;
    }

    // Mostrar nome e papel
    const infoNome = document.getElementById("infoNome");
    const infoPapel = document.getElementById("infoPapel");

    if (infoNome) infoNome.textContent = data.nome || user.email;
    if (infoPapel) infoPapel.textContent = role;

    // Carregar selects
    carregarClientesNoSelect();
    carregarFuncionariosNoSelect();

    // Formulário principal
    configurarFormPiscina();

    // Listas
    carregarPiscinas();
    carregarPiscinasAdm();

    // Funções adicionais
    configurarExportacao();
    monitorEmergenciasAdm();
    carregarFuncionariosParaFalta();

    // Botões
    const btnExportarCsv = document.getElementById("btnExportarCsv");
    if (btnExportarCsv) btnExportarCsv.addEventListener("click", exportarVisitasCsvAdm);

    const btnGerarTarefasHoje = document.getElementById("btnGerarTarefasHoje");
    if (btnGerarTarefasHoje)
      btnGerarTarefasHoje.addEventListener("click", gerarTarefasHoje);

  } catch (err) {
    console.error("Erro ao carregar ADM:", err);
    alert("Erro ao carregar painel ADM.");
  }
});

const campoBusca = document.getElementById("buscaCliente");
if (campoBusca) {
  campoBusca.addEventListener("input", () => {
    filtrarPiscinas(campoBusca.value);
  });
}

function filtrarPiscinas(texto) {
  const lista = document.getElementById("listaPiscinas");
  if (!lista) return;

  const termo = texto.toLowerCase();
  lista.innerHTML = "";

  piscinasCache
    .filter(p =>
      (p.clienteNome || "").toLowerCase().includes(termo) ||
      (p.clienteNomeReal || "").toLowerCase().includes(termo) ||
      (p.endereco || "").toLowerCase().includes(termo)
    )
    .sort((a, b) =>
      (a.clienteNome || "").localeCompare(b.clienteNome || "")
    )
    .forEach((p) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${p.clienteNome}</strong><br>
        Endereço: ${p.endereco}<br>
        Responsável: ${p.responsavelNome}<br>
      `;
      lista.appendChild(li);
    });
}

// =========================
// SELECT — CLIENTES
// =========================
function carregarClientesNoSelect() {
  const select = document.getElementById("clientePiscina");
  if (!select) return;

  select.innerHTML = '<option value="">Selecione o cliente...</option>';

  db.collection("users")
    .where("role", "==", "CLIENTE")
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        const d = doc.data();
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = d.nome || d.email;
        opt.dataset.email = d.email || "";
        select.appendChild(opt);
      });
    })
    .catch((err) => console.error("Erro ao carregar clientes:", err));
}



// =========================
// SELECT — FUNCIONÁRIOS
// =========================
function carregarFuncionariosNoSelect() {
  const select = document.getElementById("responsavelPiscina");
  if (!select) return;

  select.innerHTML = '<option value="">Selecione...</option>';

  db.collection("users")
    .where("role", "==", "FUNCIONARIO")
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        const d = doc.data();
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = d.nome || d.email || "Funcionário sem nome";
        select.appendChild(opt);
      });
    })
    .catch((err) => console.error("Erro ao carregar funcionários:", err));
}



// =========================
// FORMULÁRIO — ADICIONAR / EDITAR PISCINA
// =========================
function configurarFormPiscina() {
  const form = document.getElementById("formPiscina");
  const btnSalvar = document.getElementById("btnSalvarPiscina");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

   const clienteSelect = document.getElementById("clientePiscina");
const responsavelSelect = document.getElementById("responsavelPiscina");
const clienteNomeInput = document.getElementById("clienteNome");
const endereco = document.getElementById("endereco");
const volume = document.getElementById("volume");
const proximaVisita = document.getElementById("proximaVisita");
const msg = document.getElementById("msgPiscina");

// ✅ trava cedo se algum campo não existe (pra não dar erro de null)
if (!clienteSelect || !responsavelSelect || !clienteNomeInput || !endereco || !volume || !proximaVisita) {
  alert("Algum campo do formulário não foi encontrado. Confira os IDs no HTML.");
  console.error("Campos não encontrados:", {
    clienteSelect, responsavelSelect, clienteNomeInput, endereco, volume, proximaVisita
  });
  return;
}

if (!clienteSelect.value) return alert("Selecione o CLIENTE.");
if (!responsavelSelect.value) return alert("Selecione o RESPONSÁVEL.");

const optCliente = clienteSelect.options[clienteSelect.selectedIndex];
const optFunc = responsavelSelect.options[responsavelSelect.selectedIndex];

const dadosPiscina = {
  clienteId: clienteSelect.value,
  clienteNomeReal: optCliente?.textContent || "",
  clienteEmail: optCliente?.dataset?.email || "",
  clienteNome: clienteNomeInput.value || (optCliente?.textContent || ""),

  endereco: endereco.value || "",
  volume: Number(volume.value || 0),
  proximaVisita: proximaVisita.value || null,

  responsavelId: responsavelSelect.value,
  responsavelNome: optFunc?.textContent || "",
  funcionarioId: responsavelSelect.value,
  funcionarioNome: optFunc?.textContent || "",
};


    try {
      if (piscinaEmEdicaoId) {
        // Atualizar
        await db.collection("piscinas").doc(piscinaEmEdicaoId).update(dadosPiscina);
        msg.textContent = "Piscina atualizada!";
        msg.style.color = "green";
        piscinaEmEdicaoId = null;
        btnSalvar.textContent = "Salvar piscina";
      } else {
        // Criar nova
        await db.collection("piscinas").add({
          ...dadosPiscina,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        msg.textContent = "Piscina cadastrada!";
        msg.style.color = "green";
      }

      form.reset();
      clienteSelect.selectedIndex = 0;
      responsavelSelect.selectedIndex = 0;

      carregarPiscinas();

    } catch (err) {
      console.error("Erro ao salvar piscina:", err);
      msg.textContent = "Erro ao salvar.";
      msg.style.color = "red";
    }
  });
}



// =========================
// LISTA DE PISCINAS (CARD 2)
// =========================
function carregarPiscinas() {
  const lista = document.getElementById("listaPiscinas");
  const msgSem = document.getElementById("semPiscinas");

  if (!lista) return;

  db.collection("piscinas")
    .orderBy("clienteNome")
    .get()
    .then((snapshot) => {
      lista.innerHTML = "";
      piscinasCache = [];

      if (snapshot.empty) {
        if (msgSem) msgSem.style.display = "block";
        return;
      }

      if (msgSem) msgSem.style.display = "none";

      snapshot.forEach((doc) => {
        const d = doc.data();
        const id = doc.id;

        piscinasCache.push({ id, ...d });

        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${d.clienteNome}</strong><br>
          Cliente: ${d.clienteNomeReal}<br>
          Endereço: ${d.endereco}<br>
          Volume: ${d.volume} litros<br>
          Responsável: ${d.responsavelNome}<br>
          Próxima visita: ${d.proximaVisita || "-"}<br>
          <button class="btn-editar-piscina" data-id="${id}">Editar</button>
        `;

        lista.appendChild(li);
      });

      ativarBotoesEdicao();
    })
    .catch((err) => console.error("Erro ao carregar piscinas:", err));
}



// =========================
// BOTÕES DE EDIÇÃO DE PISCINA
// =========================
function ativarBotoesEdicao() {
  const botoes = document.querySelectorAll(".btn-editar-piscina");
  const form = document.getElementById("formPiscina");
  const btnSalvar = document.getElementById("btnSalvarPiscina");

  botoes.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const piscina = piscinasCache.find((p) => p.id === id);

      piscinaEmEdicaoId = id;

      document.getElementById("clientePiscina").value = piscina.clienteId;
      document.getElementById("responsavelPiscina").value =
        piscina.funcionarioId || piscina.responsavelId;

      document.getElementById("clienteNome").value =
        piscina.clienteNome || piscina.clienteNomeReal;

      document.getElementById("endereco").value = piscina.endereco;
      document.getElementById("volume").value = piscina.volume;

      if (piscina.proximaVisita) {
        document.getElementById("proximaVisita").value = piscina.proximaVisita;
      }

      btnSalvar.textContent = "Salvar alterações";

      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}
// =========================
// GERENCIAR PISCINAS (CARD 3) - LISTA PARA ADM
// =========================
function carregarPiscinasAdm() {
  const lista = document.getElementById("listaPiscinasAdm");
  const msg = document.getElementById("msgPiscinasAdm");

  if (!lista || !msg) {
    console.warn("Elementos de gerenciamento de piscinas (ADM) não encontrados.");
    return;
  }

  db.collection("piscinas")
    .orderBy("clienteNome")
    .onSnapshot(
      (snap) => {
        lista.innerHTML = "";

        if (snap.empty) {
          msg.style.display = "block";
          return;
        }

        msg.style.display = "none";

        snap.forEach((doc) => {
          const d = doc.data();
          const li = document.createElement("li");

          li.innerHTML = `
            <strong>${d.clienteNome || "Sem nome"}</strong><br>
            Endereço: ${d.endereco || "-"}<br>
            Responsável: ${d.responsavelNome || d.funcionarioNome || "-"}<br>
            <button class="btn-selecionar-piscina-adm" data-id="${doc.id}">
              Selecionar
            </button>
          `;

          lista.appendChild(li);
        });

        lista.querySelectorAll(".btn-selecionar-piscina-adm").forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            selecionarPiscinaAdm(id);
          });
        });
      },
      (err) => {
        console.error("Erro ao carregar piscinas (ADM):", err);
        msg.textContent = "Erro ao carregar piscinas. Veja o console.";
        msg.style.display = "block";
      }
    );
}


// =========================
// SELECIONAR PISCINA (CARD 3)
// =========================
async function selecionarPiscinaAdm(piscinaId) {
  try {
    const docSnap = await db.collection("piscinas").doc(piscinaId).get();
    if (!docSnap.exists) {
      alert("Piscina não encontrada.");
      return;
    }

    const d = docSnap.data();
    piscinaSelecionadaAdm = { id: piscinaId, ...d };

    const idInput = document.getElementById("piscina-id-adm");
    const clienteInput = document.getElementById("piscina-cliente-adm");
    const enderecoInput = document.getElementById("piscina-endereco-adm");
    const volumeInput = document.getElementById("piscina-volume-adm");
    const responsavelInput = document.getElementById("piscina-responsavel-adm");
    const proximaInput = document.getElementById("piscina-proxima-adm");

    if (idInput) idInput.value = piscinaId;
    if (clienteInput) clienteInput.value = d.clienteNome || "";
    if (enderecoInput) enderecoInput.value = d.endereco || "";
    if (volumeInput) volumeInput.value = d.volume || "";

    if (responsavelInput) responsavelInput.value = d.responsavelId || "";

    if (proximaInput) {
      if (!d.proximaVisita) {
        proximaInput.value = "";
      } else if (typeof d.proximaVisita === "string") {
        proximaInput.value = d.proximaVisita;
      } else if (d.proximaVisita.toDate) {
        const dt = d.proximaVisita.toDate();
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const dd = String(dt.getDate()).padStart(2, "0");
        proximaInput.value = `${yyyy}-${mm}-${dd}`;
      }
    }

    // Carregar histórico de visitas
    carregarVisitasAdm(piscinaId);
  } catch (err) {
    console.error("Erro ao selecionar piscina (ADM):", err);
    alert("Erro ao carregar dados da piscina.");
  }
}


// =========================
// FORMULÁRIO RÁPIDO DE EDIÇÃO (CARD 3)
// =========================
const formEditarPiscina = document.getElementById("formEditarPiscina");
if (formEditarPiscina) {
  formEditarPiscina.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const id = document.getElementById("piscina-id-adm").value;
      if (!id) {
        alert("Selecione uma piscina na lista antes de salvar.");
        return;
      }

      const cliente = document
        .getElementById("piscina-cliente-adm")
        .value.trim();
      const endereco = document
        .getElementById("piscina-endereco-adm")
        .value.trim();
      const volume = document.getElementById("piscina-volume-adm").value;
      const responsavelId = document
        .getElementById("piscina-responsavel-adm")
        .value.trim();
      const proxima = document
        .getElementById("piscina-proxima-adm")
        .value;

      const dadosAtualizados = {
        clienteNome: cliente || null,
        endereco: endereco || null,
        volume: volume ? Number(volume) : null,
        responsavelId: responsavelId || null,
        proximaVisita: proxima || null,
      };

      await db.collection("piscinas").doc(id).update(dadosAtualizados);

      alert("Piscina atualizada com sucesso!");
    } catch (err) {
      console.error("Erro ao atualizar piscina (ADM):", err);
      alert("Erro ao atualizar piscina. Veja o console.");
    }
  });
}



// =========================
// HISTÓRICO DE VISITAS (ADM)
// =========================
async function carregarVisitasAdm(piscinaId) {
  const container = document.getElementById("lista-visitas-adm");
  if (!container) return;

  container.innerHTML = "<p>Carregando visitas...</p>";

  try {
    const snap = await db
      .collection("piscinas")
      .doc(piscinaId)
      .collection("visitas")
      .orderBy("dataHora", "desc")
      .get();

    if (snap.empty) {
      container.innerHTML = "<p>Nenhuma visita registrada ainda.</p>";
      return;
    }

    let html = "";
    snap.forEach((doc) => {
      const v = doc.data();

      const data = v.dataHora
        ? new Date(
            v.dataHora.seconds ? v.dataHora.seconds * 1000 : v.dataHora
          ).toLocaleString()
        : "Data não informada";

      const prox = v.proximaVisita
        ? new Date(
            v.proximaVisita.seconds
              ? v.proximaVisita.seconds * 1000
              : v.proximaVisita
          ).toLocaleDateString()
        : "—";

      html += `
        <div style="border:1px solid #ddd; padding:8px; margin-bottom:8px;">
          <strong>Data:</strong> ${data}<br>
          <strong>Produtos:</strong> ${v.produtosUsados || "—"}<br>
          <strong>Observações:</strong> ${v.observacoes || "—"}<br>
          <strong>Próxima visita:</strong> ${prox}
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (err) {
    console.error("Erro ao carregar visitas (ADM):", err);
    container.innerHTML = "<p>Erro ao carregar visitas.</p>";
  }
}



// =========================
// EXPORTAR VISITAS CSV (CARD 3)
// =========================
async function exportarVisitasCsvAdm() {
  if (!piscinaSelecionadaAdm || !piscinaSelecionadaAdm.id) {
    alert("Selecione uma piscina antes de exportar.");
    return;
  }

  const piscinaId = piscinaSelecionadaAdm.id;

  try {
    const snap = await db
      .collection("piscinas")
      .doc(piscinaId)
      .collection("visitas")
      .orderBy("dataHora", "desc")
      .get();

    if (snap.empty) {
      alert("Nenhuma visita para exportar.");
      return;
    }

    const linhas = [];
    linhas.push("Data;Produtos;Observações;Próxima visita;Funcionário");

    snap.forEach((doc) => {
      const v = doc.data();

      const data = v.dataHora
        ? new Date(
            v.dataHora.seconds ? v.dataHora.seconds * 1000 : v.dataHora
          ).toLocaleString()
        : "";

      const prox = v.proximaVisita
        ? new Date(
            v.proximaVisita.seconds
              ? v.proximaVisita.seconds * 1000
              : v.proximaVisita
          ).toLocaleDateString()
        : "";

      const linha = [
        data.replace(/;/g, ","),
        (v.produtosUsados || "").replace(/;/g, ","),
        (v.observacoes || "").replace(/;/g, ","),
        prox,
        v.funcionarioId || "",
      ].join(";");

      linhas.push(linha);
    });

    const csvContent = linhas.join("\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    const nomeCliente = (piscinaSelecionadaAdm.clienteNome || "cliente").replace(
      /\s+/g,
      "_"
    );

    a.href = url;
    a.download = `visitas_${nomeCliente}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Erro ao exportar CSV (ADM):", err);
    alert("Erro ao exportar CSV. Veja o console.");
  }
}



// =========================
// EXPORTAR CLIENTES/PISCINAS (CARD 2)
// =========================
function configurarExportacao() {
  const btnExport = document.getElementById("btnExportarClientes");
  if (!btnExport) return;

  btnExport.addEventListener("click", () => {
    if (!piscinasCache || piscinasCache.length === 0) {
      alert("Nenhum cliente/piscina para exportar.");
      return;
    }

    const colunas = [
      "clienteNomePiscina",
      "clienteNomeCadastro",
      "clienteEmail",
      "clienteId",
      "endereco",
      "volume",
      "proximaVisita",
      "responsavelNome",
      "responsavelId",
    ];

    const linhas = [];
    linhas.push(colunas.join(";"));

    piscinasCache.forEach((p) => {
      const linha = [
        p.clienteNome || "",
        p.clienteNomeReal || "",
        p.clienteEmail || "",
        p.clienteId || "",
        p.endereco || "",
        p.volume || "",
        p.proximaVisita || "",
        p.responsavelNome || p.funcionarioNome || "",
        p.responsavelId || p.funcionarioId || "",
      ]
        .map((v) => String(v).replace(/;/g, ","))
        .join(";");

      linhas.push(linha);
    });

    const csvContent = linhas.join("\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "clientes-piscinas-acquashow.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}



// =========================
// GERAR TAREFAS DIÁRIAS
// =========================
async function gerarTarefasHoje() {
  const msg = document.getElementById("msgTarefasAdm");
  if (msg) {
    msg.textContent = "Gerando tarefas de hoje...";
    msg.style.color = "#555";
  }

  const hoje = new Date();
  const yyyy = hoje.getFullYear();
  const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  const dd = String(hoje.getDate()).padStart(2, "0");
  const dataStr = `${yyyy}-${mm}-${dd}`;

  try {
    const snapPisc = await db.collection("piscinas").get();

    if (snapPisc.empty) {
      if (msg) {
        msg.textContent = "Nenhuma piscina cadastrada para gerar tarefas.";
        msg.style.color = "orange";
      }
      return;
    }

    const tarefasRef = db.collection("tarefasDiarias");

    const existentesSnap = await tarefasRef
      .where("data", "==", dataStr)
      .get();

    const jaCriadas = new Set();
    existentesSnap.forEach((doc) => {
      const t = doc.data();
      if (t.funcionarioId && t.piscinaId) {
        jaCriadas.add(`${t.funcionarioId}_${t.piscinaId}`);
      }
    });

    const batch = db.batch();
    let contador = 0;

    snapPisc.forEach((doc) => {
      const p = doc.data();
      const piscinaId = doc.id;

      if (!p.responsavelId) return;

      const chave = `${p.responsavelId}_${piscinaId}`;
      if (jaCriadas.has(chave)) return;

      const novaRef = tarefasRef.doc();
      batch.set(novaRef, {
        funcionarioId: p.responsavelId,
        piscinaId: piscinaId,
        clienteNome: p.clienteNome || p.clienteNomeReal || "",
        endereco: p.endereco || "",
        data: dataStr,
        status: "PENDENTE",
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
      contador++;
    });

    if (contador === 0) {
      if (msg) {
        msg.textContent =
          "Nenhuma nova tarefa criada (já existiam tarefas para hoje).";
        msg.style.color = "orange";
      }
      return;
    }

    await batch.commit();

    if (msg) {
      msg.textContent = `Tarefas de hoje geradas com sucesso: ${contador}`;
      msg.style.color = "green";
    }
  } catch (erro) {
    console.error("Erro ao gerar tarefas do dia:", erro);
    if (msg) {
      msg.textContent = "Erro ao gerar tarefas. Veja o console.";
      msg.style.color = "red";
    }
  }
}



// =========================
// CADASTRAR NOVO USUÁRIO (ADM / FUNC / CLI)
// =========================
const secondaryApp =
  firebase.apps.find((app) => app.name === "Secondary") ||
  firebase.initializeApp(firebaseConfig, "Secondary");

const secondaryAuth = secondaryApp.auth();

const formCadastro = document.getElementById("formCadastroUsuario");
if (formCadastro) {
  formCadastro.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nome = document.getElementById("nomeUsuario").value.trim();
    const email = document.getElementById("emailUsuario").value.trim();
    const telefone = document.getElementById("telefoneUsuario").value.trim();
    const senha = document.getElementById("senhaUsuario").value.trim();
    const roleRaw = document.getElementById("roleUsuario").value.trim();

    const roleMap = {
      Administrador: "ADM",
      ADM: "ADM",
      Funcionario: "FUNCIONARIO",
      Funcionário: "FUNCIONARIO",
      FUNCIONARIO: "FUNCIONARIO",
      Cliente: "CLIENTE",
      CLIENTE: "CLIENTE",
    };

    const role = (roleMap[roleRaw] || roleRaw || "").toUpperCase();

    if (!nome || !email || !senha || !role) {
      alert("Preencha nome, e-mail, senha e nível de acesso.");
      return;
    }

    try {
      const userCred = await secondaryAuth.createUserWithEmailAndPassword(
        email,
        senha
      );
      const uid = userCred.user.uid;

      await db.collection("users").doc(uid).set({
        nome,
        email,
        telefone,
        role,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });

      alert("Usuário criado com sucesso!");
      formCadastro.reset();

      if (role === "FUNCIONARIO") carregarFuncionariosNoSelect();
      if (role === "CLIENTE") carregarClientesNoSelect();
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      alert(
        "Erro ao criar usuário: " +
          (error.code || "") +
          " - " +
          (error.message || "")
      );
    }
  });
}



// =========================
// FUNCIONÁRIO FALTOU — CARREGAR LISTAS
// (funcFaltou, funcSubstituto, funcFaltaHoje)
// =========================
function carregarFuncionariosParaFalta() {
  const selectFaltou = document.getElementById("funcFaltou");
  const selectSub = document.getElementById("funcSubstituto");
  const selectFaltaHoje = document.getElementById("funcFaltaHoje");

  db.collection("users")
    .where("role", "==", "FUNCIONARIO")
    .get()
    .then((snapshot) => {
      if (selectFaltou) {
        selectFaltou.innerHTML = '<option value="">Selecione...</option>';
      }
      if (selectSub) {
        selectSub.innerHTML = '<option value="">Selecione...</option>';
      }
      if (selectFaltaHoje) {
        selectFaltaHoje.innerHTML = '<option value="">Selecione...</option>';
      }

      snapshot.forEach((doc) => {
        const d = doc.data();
        const nome = d.nome || d.email || "Funcionário sem nome";

        if (selectFaltou) {
          const opt1 = document.createElement("option");
          opt1.value = doc.id;
          opt1.textContent = nome;
          selectFaltou.appendChild(opt1);
        }

        if (selectSub) {
          const opt2 = document.createElement("option");
          opt2.value = doc.id;
          opt2.textContent = nome;
          selectSub.appendChild(opt2);
        }

        if (selectFaltaHoje) {
          const opt3 = document.createElement("option");
          opt3.value = doc.id;
          opt3.textContent = nome;
          selectFaltaHoje.appendChild(opt3);
        }
      });
    })
    .catch((err) => {
      console.error("Erro ao carregar funcionários para falta:", err);
    });
}



// =========================
// REPASSAR TAREFAS QUANDO FUNCIONÁRIO FALTA
// =========================
async function repassarTarefasPorFalta() {
  const selectFaltou = document.getElementById("funcFaltou");
  const selectSub = document.getElementById("funcSubstituto");
  const msg = document.getElementById("msgFaltaAdm");

  if (!selectFaltou || !selectSub) {
    alert("Campos de falta não encontrados.");
    return;
  }

  const idFaltou = selectFaltou.value;
  const idSub = selectSub.value;

  if (!idFaltou) {
    alert("Selecione o funcionário que faltou.");
    return;
  }
  if (!idSub) {
    alert("Selecione o funcionário que vai assumir as tarefas.");
    return;
  }
  if (idFaltou === idSub) {
    alert("O substituto precisa ser diferente do funcionário que faltou.");
    return;
  }

  if (msg) {
    msg.textContent = "Repassando tarefas de hoje...";
    msg.style.color = "#555";
  }

  const hoje = new Date();
  const yyyy = hoje.getFullYear();
  const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  const dd = String(hoje.getDate()).padStart(2, "0");
  const dataStr = `${yyyy}-${mm}-${dd}`;

  try {
    const snap = await db
      .collection("tarefasDiarias")
      .where("funcionarioId", "==", idFaltou)
      .where("data", "==", dataStr)
      .where("status", "==", "PENDENTE")
      .get();

    if (snap.empty) {
      if (msg) {
        msg.textContent =
          "Esse funcionário não tem tarefas pendentes hoje.";
        msg.style.color = "orange";
      }
      return;
    }

    const batch = db.batch();
    let count = 0;

    snap.forEach((doc) => {
      batch.update(doc.ref, { funcionarioId: idSub });
      count++;
    });

    await batch.commit();

    if (msg) {
      msg.textContent = `Tarefas de hoje repassadas com sucesso: ${count}`;
      msg.style.color = "green";
    }
  } catch (erro) {
    console.error("Erro ao repassar tarefas por falta:", erro);
    if (msg) {
      msg.textContent = "Erro ao repassar tarefas. Veja o console.";
      msg.style.color = "red";
    }
  }
}



// =========================
// MONITORAR EMERGÊNCIAS - ADM
// =========================
function monitorEmergenciasAdm() {
  const lista = document.getElementById("listaEmergAdm");
  const msg = document.getElementById("msgEmergAdm");
  const badge = document.getElementById("badgeEmergAdm");

  if (!lista) {
    console.warn(
      "Elemento de lista de emergências (ADM) não encontrado."
    );
    return;
  }

  db.collection("emergencias")
    .where("status", "==", "ABERTA")
    .orderBy("criadaEm", "desc")
    .onSnapshot(
      (snapshot) => {
        lista.innerHTML = "";

        const total = snapshot.size;
        if (badge) badge.textContent = total > 0 ? String(total) : "";
        if (msg) msg.textContent = total === 0 ? "Nenhuma emergência aberta." : "";

        if (snapshot.empty) return;

        snapshot.forEach((doc) => {
          const e = doc.data();
          let dataTxt = "-";

          if (e.criadaEm && typeof e.criadaEm.toDate === "function") {
            const d = e.criadaEm.toDate();
            const dia = String(d.getDate()).padStart(2, "0");
            const mes = String(d.getMonth() + 1).padStart(2, "0");
            const ano = d.getFullYear();
            const hora = String(d.getHours()).padStart(2, "0");
            const min = String(d.getMinutes()).padStart(2, "0");
            const seg = String(d.getSeconds()).padStart(2, "0");
            dataTxt = `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`;
          }

          const li = document.createElement("li");
          li.innerHTML = `
            <strong>${e.piscinaNome || "Piscina"}</strong> - ${
            e.tipo || ""
          }<br>
            Cliente: ${e.clienteNome || "-"}<br>
            Responsável: ${e.responsavelNome || "-"}<br>
            Data/hora: ${dataTxt}<br>
            Obs.: ${e.descricao || "-"}<br>
            <button class="btn-resolver-emerg" data-id="${doc.id}">
              Marcar como resolvida
            </button>
          `;

          lista.appendChild(li);
        });

        lista
          .querySelectorAll(".btn-resolver-emerg")
          .forEach((btn) => {
            btn.addEventListener("click", async () => {
              const id = btn.dataset.id;
              if (!id) return;

              const confirma = confirm(
                "Confirmar que essa emergência foi resolvida?"
              );
              if (!confirma) return;

              try {
                const user = auth.currentUser;
                await db.collection("emergencias").doc(id).update({
                  status: "RESOLVIDA",
                  resolvidaEm:
                    firebase.firestore.FieldValue.serverTimestamp(),
                  resolvidaPorUid: user ? user.uid : null,
                  resolvidaPorEmail: user ? user.email : null,
                });
              } catch (err) {
                console.error(
                  "Erro ao marcar emergência como resolvida (ADM):",
                  err
                );
                alert(
                  "Erro ao marcar emergência como resolvida. Veja o console."
                );
              }
            });
          });
      },
      (err) => {
        console.error("Erro ao ouvir emergências (ADM):", err);
        if (msg) {
          msg.textContent =
            "Erro ao carregar emergências. Veja o console.";
        }
      }
    );
}



// =========================
// FUNCIONÁRIOS PERMITIDOS (CHECKBOX)
// =========================
function carregarFuncionariosPermitidosSelecionaveis(funcsSelecionados = []) {
  const box = document.getElementById("listaFuncPermitidos");
  if (!box) return;

  box.innerHTML = "Carregando...";

  db.collection("users")
    .where("role", "==", "FUNCIONARIO")
    .get()
    .then((snapshot) => {
      if (snapshot.empty) {
        box.innerHTML =
          "<p class='muted'>Nenhum funcionário encontrado.</p>";
        return;
      }

      let html = "";
      snapshot.forEach((doc) => {
        const f = doc.data();
        const uid = doc.id;
        const checked = funcsSelecionados.includes(uid) ? "checked" : "";

        html += `
          <label style="display:block; margin-bottom:6px;">
            <input
              type="checkbox"
              class="chk-func-permitido"
              value="${uid}"
              ${checked}
            />
            ${f.nome || f.email}
          </label>
        `;
      });

      box.innerHTML = html;
    });
}



// =========================
// LEMBRETES (LISTA NO FORM DE EDIÇÃO)
// =========================
function atualizarListaLembretes() {
  const ul = document.getElementById("listaLembretes");
  if (!ul) return;

  ul.innerHTML = "";

  lembretesTemp.forEach((l) => {
    ul.innerHTML += `
      <li>
        ${l.texto}
        <button
          data-id="${l.id}"
          class="btn-remover-lembrete"
          style="margin-left:10px;"
        >
          Remover
        </button>
      </li>
    `;
  });

  document
    .querySelectorAll(".btn-remover-lembrete")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        lembretesTemp = lembretesTemp.filter((x) => x.id !== id);
        atualizarListaLembretes();
      });
    });
}

const btnAddLembrete = document.getElementById("btnAddLembrete");
if (btnAddLembrete) {
  btnAddLembrete.addEventListener("click", () => {
    const campo = document.getElementById("novoLembrete");
    if (!campo || !campo.value.trim())
      return alert("Digite um lembrete.");

    const novo = {
      id: Math.random().toString(36).substr(2, 9),
      texto: campo.value.trim(),
      ativo: true,
      criadoEm: new Date(),
    };

    lembretesTemp.push(novo);
    campo.value = "";
    atualizarListaLembretes();
  });
}



// =========================
// SALVAR PISCINA (COM FUNCIONÁRIOS PERMITIDOS + LEMBRETES)
// (se você quiser evoluir o form no futuro)
// =========================
async function salvarPiscina(dadosBase, piscinaId = null) {
  const checkboxes = document.querySelectorAll(".chk-func-permitido");
  const funcsPermitidos = [];

  checkboxes.forEach((chk) => {
    if (chk.checked) funcsPermitidos.push(chk.value);
  });

  const dados = {
    ...dadosBase,
    funcionariosPermitidos: funcsPermitidos,
    lembretes: lembretesTemp,
  };

  if (piscinaId) {
    return db.collection("piscinas").doc(piscinaId).update(dados);
  } else {
    return db.collection("piscinas").add(dados);
  }
}



// =========================
// GERAR REDISTRIBUIÇÃO (FUNC FALTOU HOJE)
// =========================
function gerarRedistribuicao() {
  const funcId = document.getElementById("funcFaltaHoje")?.value;
  const box = document.getElementById("resultadoRedistribuicao");

  if (!funcId) {
    alert("Selecione o funcionário que faltou.");
    return;
  }

  if (!box) return;
  box.innerHTML = "<p>Carregando piscinas...</p>";

  db.collection("piscinas")
    .where("responsavelId", "==", funcId)
    .get()
    .then((snapshot) => {
      if (snapshot.empty) {
        box.innerHTML =
          "<p class='muted'>Nenhuma piscina atribuída a este funcionário.</p>";
        return;
      }

      let html = "<h3>Piscinas para remanejar</h3>";

      snapshot.forEach((doc) => {
        const p = doc.data();
        const id = doc.id;

        html += `
          <div style="padding:10px; border:1px solid #ccc; margin-bottom:10px; border-radius:8px;">
            <strong>${p.clienteNome}</strong><br>
            Endereço: ${p.endereco}<br><br>
            Funcionários permitidos:
        `;

      // DEFINIR FUNCIONÁRIOS PERMITIDOS (REGRA SEGURA)
let permitidos = [];

if (Array.isArray(p.funcionariosPermitidos) && p.funcionariosPermitidos.length > 0) {
  permitidos = p.funcionariosPermitidos;
} else if (p.responsavelId) {
  // fallback: pelo menos o responsável atual
  permitidos = [p.responsavelId];
}

if (permitidos.length === 0) {
  html += "<p style='color:red;'>Nenhum funcionário disponível para remanejamento.</p>";
} else {
  permitidos.forEach((uid) => {
    html += `
      <button class="btnRemanejar" data-piscina="${id}" data-novo="${uid}">
        Passar para ${uid}
      </button>
    `;
  });
}


        html += "</div>";
      });

      box.innerHTML = html;
      ativarBotoesRemanejamento();
    });
}

function ativarBotoesRemanejamento() {

  const btns = document.querySelectorAll(".btnRemanejar");

  btns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const piscinaId = btn.dataset.piscina;
      const novoResp = btn.dataset.novo;

      try {
        await db.collection("piscinas").doc(piscinaId).update({
          responsavelId: novoResp,
        });

        alert("Piscina remanejada com sucesso!");
        gerarRedistribuicao();
      } catch (err) {
        console.error("Erro ao remanejar piscina:", err);
        alert("Erro ao remanejar. Veja o console.");
      }
    });
  });
}

const btnGerarRedistribuicao = document.getElementById("btnGerarRedistribuicao");
if (btnGerarRedistribuicao) {
  btnGerarRedistribuicao.addEventListener("click", gerarRedistribuicao);
}
document.getElementById("btnAddVisita")?.addEventListener("click", () => {
  const campo = document.getElementById("novaVisitaExtra");
  if (!campo.value) return;

  visitasExtrasTemp.push(campo.value);
  atualizarListaVisitas();
  campo.value = "";
});

function atualizarListaVisitas() {
  const ul = document.getElementById("listaVisitas");
  if (!ul) return;

  ul.innerHTML = "";
  visitasExtrasTemp.forEach((v) => {
    ul.innerHTML += `<li>${v}</li>`;
  });
}
