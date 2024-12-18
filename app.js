const express = require("express");
const session = require("express-session");
const serverless = require("serverless-http");
const MemoryStore = require("memorystore")(session);
const axios = require("axios");
const https = require("https");
const fs = require("fs");
require("dotenv").config();
const path = require("path"); // Adicionado importação do path

const app = express();
const port = 3000;

// Configuração do certificado PFX
const httpsAgent = new https.Agent({
    pfx: (() => {
        try {
            const pfxPath = path.join(process.cwd(), 'certs', 'INSTITUTO_DE_DIGNIDADE.pfx');
            return fs.readFileSync(pfxPath);
        } catch (err) {
            console.error("❌ Erro ao carregar o arquivo PFX:", err.message);
            process.exit(1);
        }
    })(),
    passphrase: process.env.PFXPASSWORD,
    rejectUnauthorized: true,
});

// Configurar EJS e arquivos estáticos
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Configuração da sessão
app.use(
    session({
        cookie: { maxAge: 86400000 }, // Expira em 1 dia
        store: new MemoryStore({
            checkPeriod: 86400000, // Limpeza periódica de 1 dia
        }),
        secret: process.env.SESSION_SECRET, // Chave secreta
        resave: false,
        saveUninitialized: true,
    })
);

// Autenticação básica
const checkAuth = (req, res, next) => {
    if (req.session.authenticated) return next();
    res.redirect("/login");
};

// Tela de Login
app.get("/login", (req, res) => {
    res.render("login", { error: null });
});

app.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (username === process.env.USERNAME && password === process.env.PASSWORD) {
        req.session.authenticated = true;
        res.redirect("/dashboard"); // Redireciona para /dashboard
    } else {
        res.render("login", { error: "Usuário ou senha inválidos" });
    }
});


// Logout
app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login"));
});

app.get("/", (req, res) => {
    if (req.session.authenticated) {
        return res.redirect("/dashboard");
    }
    res.redirect("/login");
});


// Proteger a rota principal
app.get("/", checkAuth, async (req, res) => {
    try {
        const token = await getBearerToken();
        const balances = await Promise.all(
            Object.entries(accountsData).map(async ([name, { type, agency, account }]) => {
                const saldo = await getAccountBalance(token, agency, account);
                return { name, type, agency, account, saldo };
            })
        );
        res.render("dashboard", { balances });
    } catch (error) {
        console.error("❌ Erro ao obter dados:", error.message);
        res.status(500).send("Erro ao processar os dados.");
    }
});


// Lista completa de contas
const accountsData = {
    RADIO_ITATIAIA: { type: "IDDS", agency: 503, account: 103731 },
    HUB_MOUNTAIN_VIEW: { type: "IDDS", agency: 503, account: 103731 },
    HUB_BH_CONCORDIA: { type: "IDDS", agency: 503, account: 103532 },
    HS_LABORATORIO_CONTAGEM: { type: "IDDS", agency: 503, account: 103533 },
    NUCLEO_OFTALMOLOGIA_ESPECIALIZADA: { type: "IDDS", agency: 503, account: 103535 },
    DIRECIONAL: { type: "IDDS", agency: 503, account: 103441 },
    EMCCAMP: { type: "IDDS", agency: 750, account: 228444 },
    IPREMB: { type: "IDDS", agency: 750, account: 228445 },
    IFFAR_FREDERICO: { type: "IDDS", agency: 503, account: 104518 },
    IFFAR_SANTA_MARIA: { type: "IDDS", agency: 503, account: 104519 },
    IFFAR_ALEGRETE: { type: "IDDS", agency: 503, account: 103894 },
    IFFAR_JAGUARI: { type: "IDDS", agency: 503, account: 104255 },
    LUNI_LOG: { type: "IDDS", agency: 503, account: 104517 },
    IFFAR_SANTO_AUGUSTO: { type: "IDDS", agency: 503, account: 104520 },
    IFFAR_JULIO_CASTILHOS: { type: "IDDS", agency: 503, account: 104521 },
    IFFAR_SANTO_ANGELO: { type: "IDDS", agency: 503, account: 104564 },
    TRANSPORTE_HUMANIZADO_BETIM: { type: "IDDS", agency: 503, account: 103534 },
    EDITAIS: { type: "IDDS", agency: 750, account: 228443 },
    SEDE_IDDS: { type: "IDDS", agency: 750, account: 228447 },
    VIVER_ITINERANTE: { type: "IDDS", agency: 750, account: 228447 },
    ESCRITORIO_SOCIAL_BH: { type: "IDDS", agency: 750, account: 228447 },
    ESCRITORIO_SOCIAL_SETE_LAGOAS: { type: "IDDS", agency: 750, account: 228447 },
    PROSSEGUR: { type: "IDDS", agency: 750, account: 228447 },
    SEDE_IDDS_CONTRATOS_ADM: { type: "IDDS", agency: 750, account: 228449 },
    HUB_IVECO_ESCRITORIO_ADM_SP: { type: "IDDS", agency: 750, account: 228450 },
    MERCANTIL: { type: "IDDS", agency: 750, account: 228451 },
    BEM_AQUI_RJ: { type: "IDDS", agency: 750, account: 308454 },
    SECRETARIA_SAUDE_RS: { type: "IDDS", agency: 503, account: 104340 },
    SPX_SERVICOS_IMAGEM_SANTANA: { type: "IDDS", agency: 503, account: 104341 },
    SPX_SERVICOS_IMAGEM_TAUBATE: { type: "IDDS", agency: 503, account: 104342 },
    RCS_SOLUCOES_MEDICAS: { type: "IDDS", agency: 503, account: 104343 },
    INSTITUTO_CURITIBA_INFORMATICA: { type: "IDDS", agency: 503, account: 104344 },
    INSTITUTO_FEDERAL_RJ: { type: "IDDS", agency: 503, account: 104415 },
    CURRAIS_NOVOS: { type: "IDDS", agency: 503, account: 104441 },
    TJ: { type: "IDDS", agency: 503, account: 104442 },
    TJ2: { type: "IDDS", agency: 503, account: 104443 },
    TJ3: { type: "IDDS", agency: 503, account: 104444 },
    SEPLAG_AGER: { type: "IDDS", agency: 503, account: 104446 },
    PHV_PRIVADO: { type: "IDDS", agency: 503, account: 104447 },
    MCA_AUDITORIA_GERENCIAMENTO: { type: "IDDS", agency: 503, account: 104448 },
    TERMO_DE_FOMENTO_FMS: {
        type: "IDDS",
        agency: 750,
        account: 128440
      },
      MEDCARE: {
        type: "IDDS",
        agency: 750,
        account: 228446
      },
      ESCRITORIO_SOCIAL_JABOTICATUBAS_BETIM: {
        type: "IDDS",
        agency: 503,
        account: 103442
      },
      EDUCACAO_BETIM: {
        type: "IDDS",
        agency: 503,
        account: 103990
      },
};

// Função para obter a data de hoje
function getTodayDate() {
    const now = new Date();
    // Ajusta para o timezone do Brasil (UTC-3)
    const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    
    return `${String(brazilTime.getUTCDate()).padStart(2, "0")}${
        String(brazilTime.getUTCMonth() + 1).padStart(2, "0")}${
        brazilTime.getUTCFullYear()}`;
}

async function getBearerToken() {
    try {
        console.log("🔄 Iniciando obtenção do token...");
        console.log("📍 URL de autenticação:", process.env.AUTH_URL);
        console.log("🔑 Client ID disponível:", !!process.env.CLIENT_ID);
        console.log("🔐 Client Secret disponível:", !!process.env.CLIENT_SECRET);

        const response = await axios.post(process.env.AUTH_URL, 
            new URLSearchParams({
                grant_type: "client_credentials",
                scope: "extrato-info",
            }), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                auth: { username: process.env.CLIENT_ID, password: process.env.CLIENT_SECRET },
                httpsAgent,
            }
        );

        console.log("✅ Token obtido. Comprimento:", response.data.access_token.length);
        return response.data.access_token;
    } catch (error) {
        console.error("❌ Erro ao obter token:");
        console.error("Status:", error.response?.status);
        console.error("Dados do erro:", error.response?.data);
        console.error("Headers da resposta:", error.response?.headers);
        throw error;
    }
}


// Dashboard otimizado
app.get("/dashboard", async (req, res) => {
    if (!req.session.authenticated) {
        return res.redirect("/login");
    }

    try {
        // Renderiza o dashboard inicial sem dados
        res.render("dashboard", { loading: true });
    } catch (error) {
        console.error("❌ Erro ao carregar dashboard:", error.message);
        res.status(500).send("Erro interno no servidor");
    }
});

// API para carregar saldos em partes
app.get("/api/balances", async (req, res) => {
    if (!req.session.authenticated) {
        return res.status(401).json({ error: "Não autorizado" });
    }

    try {
        const page = parseInt(req.query.page) || 0;
        const pageSize = 5; // Reduzido para 5 por vez
        const start = page * pageSize;
        const accounts = Object.entries(accountsData).slice(start, start + pageSize);

        if (accounts.length === 0) {
            return res.json({ balances: [], hasMore: false });
        }

        const token = await getBearerToken();
        const balances = await Promise.all(
            accounts.map(async ([name, { type, agency, account }]) => {
                const saldo = await getAccountBalance(token, agency, account);
                return { name, type, agency, account, saldo };
            })
        );

        res.json({
            balances,
            hasMore: start + pageSize < Object.keys(accountsData).length
        });
    } catch (error) {
        console.error("❌ Erro ao carregar saldos:", error.message);
        res.status(500).json({ error: "Erro ao carregar saldos" });
    }
});


// Na função de obter saldo
async function getAccountBalance(token, agency, account) {
    const url = `${process.env.BASE_URL}/extratos/v1/conta-corrente/agencia/${agency}/conta/${account}`;
    const today = getTodayDate();

    console.log(`\n🔄 Iniciando consulta de saldo:`);
    console.log(`📍 URL: ${url}`);
    console.log(`📅 Data: ${today}`);
    console.log(`🏦 Agência: ${agency}, Conta: ${account}`);
    console.log(`🔑 Token disponível: ${!!token}`);
    console.log(`🔑 GW_DEV_APP_KEY disponível: ${!!process.env.GW_DEV_APP_KEY}`);

    try {
        const response = await axios.get(url, {
            headers: { 
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            params: { 
                "gw-dev-app-key": process.env.GW_DEV_APP_KEY, 
                dataInicioSolicitacao: today, 
                dataFimSolicitacao: today 
            },
            httpsAgent,
            validateStatus: false // Para logar todos os status codes
        });

        console.log(`📊 Status da resposta: ${response.status}`);
        if (response.status !== 200) {
            console.error(`❌ Resposta não-200:`, response.data);
            return "Erro";
        }

        const saldo = response.data.listaLancamento?.find(item => 
            item.textoDescricaoHistorico.trim() === "S A L D O"
        );

        console.log(`✅ Saldo encontrado: ${!!saldo}`);
        return saldo ? saldo.valorLancamento : "N/A";
    } catch (error) {
        console.error(`\n❌ Erro detalhado para conta ${account}:`);
        console.error(`📍 URL completa: ${error.config?.url}`);
        console.error(`🔐 Headers enviados:`, error.config?.headers);
        console.error(`📊 Status do erro:`, error.response?.status);
        console.error(`📝 Mensagem do erro:`, error.response?.data || error.message);
        console.error(`🔍 Stack trace:`, error.stack);
        return "Erro";
    }
}

// Exporte o servidor para Vercel
module.exports = app;
module.exports.handler = serverless(app);

// Verifique se o script está rodando localmente
if (require.main === module) {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`🚀 Servidor rodando localmente em http://localhost:${port}`);
    });
}