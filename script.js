// script.js - arquitectura helpers, API, tema, localStorage, lógica completa
// helpers seguros
function getEl(id) { const el = document.getElementById(id); if (!el) console.warn(`Elemento ${id} no encontrado`); return el; }
function setText(id, text) { const el = getEl(id); if (el) el.textContent = text; }
function setHtml(id, html) { const el = getEl(id); if (el) el.innerHTML = html; }
function setWidth(id, width) { const el = getEl(id); if (el) el.style.width = width; }
function setProperty(id, prop, val) { const el = getEl(id); if (el) el.style.setProperty(prop, val); }
function addClass(id, cls) { const el = getEl(id); if (el) el.classList.add(cls); }
function removeClass(id, cls) { const el = getEl(id); if (el) el.classList.remove(cls); }

// Modelo actualizado a llama-3.3-70b-versatile
let appConfig = { app_name: "CodeMind AI", app_emoji: "🧠", api_model: "llama-3.3-70b-versatile", temperature: 0.7, max_tokens: 4000 };
let currentScore = 0;

// Toast
function showToast(message, type = "info") {
    const container = getEl("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    const emoji = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" }[type] || "🔔";
    toast.innerHTML = `${emoji} ${message}`;
    toast.style.borderLeftColor = type === "success" ? "var(--success)" : type === "error" ? "var(--danger)" : "var(--primary)";
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 4000);
}

// confetti 50 partículas
function launchConfetti() {
    const canvas = document.createElement("canvas");
    canvas.id = "confetti-canvas";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let particles = [];
    for (let i = 0; i < 50; i++) {
        particles.push({ x: Math.random() * canvas.width, y: -20, size: Math.random() * 6 + 3, speedY: Math.random() * 5 + 3, speedX: (Math.random() - 0.5) * 2, color: `hsl(${Math.random() * 360}, 70%, 60%)` });
    }
    let animation;
    function draw() {
        if (!canvas.parentNode) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let allDead = true;
        particles.forEach(p => {
            p.y += p.speedY;
            p.x += p.speedX;
            if (p.y < canvas.height + 50) allDead = false;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        });
        if (allDead) { canvas.remove(); cancelAnimationFrame(animation); return; }
        animation = requestAnimationFrame(draw);
    }
    draw();
    setTimeout(() => { if(canvas.parentNode) canvas.remove(); }, 3000);
}

// función para sparkle en clicks
function addSparkle(e) {
    const spark = document.createElement("div");
    spark.textContent = "✨";
    spark.style.position = "absolute";
    spark.style.left = `${e.clientX - 10}px`;
    spark.style.top = `${e.clientY - 10}px`;
    spark.style.fontSize = "20px";
    spark.style.pointerEvents = "none";
    spark.style.animation = "sparkle 0.6s forwards";
    document.body.appendChild(spark);
    setTimeout(() => spark.remove(), 600);
}
// añadir keyframes sparkle dinámicamente
if (!document.querySelector("#sparkleStyle")) {
    const style = document.createElement("style");
    style.id = "sparkleStyle";
    style.textContent = `@keyframes sparkle { 0% { transform: scale(0.5) rotate(0deg); opacity:1;} 100% { transform: scale(1.5) rotate(45deg); opacity:0;}}`;
    document.head.appendChild(style);
}

// API call AI 
async function callAI(prompt, systemExtra = "") {
    const apiKey = getEl("apiKeyInput")?.value.trim();
    if (!apiKey) { showToast("🔑 Ingresa tu API Key (Groq/OpenAI)", "warning"); throw new Error("Missing API Key"); }
    const model = appConfig.api_model;
    const messages = [{ role: "system", content: `Eres un experto ingeniero de software. ${systemExtra} Responde en español, claro y útil.` }, { role: "user", content: prompt }];
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, temperature: appConfig.temperature, max_tokens: appConfig.max_tokens })
    });
    if (!res.ok) {
        let errMsg = "Error en API";
        if (res.status === 401) errMsg = "❌ API Key inválida, verifica tus credenciales";
        else if (res.status === 404) errMsg = "⚠️ Modelo descontinuado, actualiza config.json";
        else if (res.status === 429) errMsg = "⏳ Rate limit excedido, espera unos segundos";
        else if (res.status === 403) errMsg = "🔒 Acceso denegado, revisa tu plan";
        const errorText = await res.text().catch(()=>"");
        console.error("API error", errorText);
        showToast(errMsg, "error");
        throw new Error(errMsg);
    }
    const data = await res.json();
    return data.choices[0].message.content;
}

// Función análisis y puntuación
async function analyzeCode() {
    const code = getEl("codeInput")?.value;
    if (!code.trim()) { showToast("📝 Ingresa código para analizar", "warning"); return; }
    const lang = getEl("languageSelect")?.value;
    showProgressBar(true);
    try {
        const prompt = `Analiza el siguiente código en ${lang}. Devuelve ÚNICAMENTE un objeto JSON válido con "score" (0-100) y "analysis" (texto detallado con emojis y sugerencias). Codigo:\n${code}`;
        const response = await callAI(prompt, "Entregas JSON estricto sin markdown adicional.");
        let parsed;
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
        } catch(e) { parsed = { score: 70, analysis: response }; }
        const score = Math.min(100, Math.max(0, Number(parsed.score) || 70));
        currentScore = score;
        updateScoreCircle(score);
        setHtml("analysisResult", `<div>🧪 <strong>Puntuación calidad: ${score}/100</strong><br>📋 ${parsed.analysis.replace(/\n/g,'<br>')}</div>`);
        if (score >= 90) launchConfetti();
        showToast(`Análisis completado: ${score} puntos`, "success");
    } catch (err) { console.error(err); setHtml("analysisResult", "<div>❌ Error al analizar, revisa API Key</div>"); }
    finally { showProgressBar(false); }
}

async function optimizeCode() {
    const code = getEl("codeInput")?.value;
    if (!code.trim()) { showToast("Código necesario para optimizar", "warning"); return; }
    const lang = getEl("languageSelect")?.value;
    showProgressBar(true);
    try {
        const prompt = `Optimiza este código ${lang} para máximo rendimiento, claridad y mejores prácticas. Devuelve JSON: {"optimized_code": "...", "explicacion": "..."}. Código:\n${code}`;
        const res = await callAI(prompt, "Formato JSON estricto sin texto extra");
        const jsonMatch = res.match(/\{[\s\S]*\}/);
        const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { optimized_code: res, explicacion: "Optimización generada" };
        const optCode = data.optimized_code || res;
        setHtml("optimizationResult", `<strong>✨ Optimización:</strong><br>${optCode.replace(/`/g, '`')}<br><br><strong>📘 Explicación:</strong> ${data.explicacion}`);
        showToast("Código optimizado listo 🚀", "success");
    } catch(e) { showToast("Error en optimización", "error"); console.error(e); }
    finally { showProgressBar(false); }
}

async function generateCode() {
    const promptDesc = getEl("generatePrompt")?.value;
    if (!promptDesc) { showToast("Describe qué código generar", "warning"); return; }
    const lang = getEl("languageSelect")?.value;
    showProgressBar(true);
    try {
        const response = await callAI(`Genera código en ${lang} para: ${promptDesc}. Incluye explicación breve al inicio.`, "Entrega código limpio y funcional.");
        setHtml("generatedCodeResult", `<pre><code>${response.replace(/</g, '&lt;')}</code></pre>`);
        showToast("✨ Código generado con IA", "success");
    } catch(e) { showToast("Error generación", "error");}
    finally { showProgressBar(false); }
}

// score canvas
function updateScoreCircle(score) {
    const canvas = getEl("scoreCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const percent = score / 100;
    const radius = 50;
    const centerX = 60, centerY = 60;
    ctx.clearRect(0, 0, 120, 120);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "var(--bg-input)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * percent);
    ctx.strokeStyle = "var(--primary)";
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.fillStyle = "var(--text)";
    ctx.font = "bold 22px monospace";
    ctx.fillText(`${score}`, 42, 72);
    setText("scorePercent", `${score}%`);
    addClass("scoreCircleWrapper", "rotate-in");
    setTimeout(() => removeClass("scoreCircleWrapper", "rotate-in"), 600);
}
function showProgressBar(show) {
    const bar = getEl("progressBarFill");
    if (bar) bar.style.width = show ? "80%" : "0%";
}

// archivo drag & drop
function setupDragAndDrop() {
    const zone = getEl("dropZone");
    const fileInput = getEl("fileInput");
    const fileNameSpan = getEl("fileNameBadge");
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", async (e) => {
        e.preventDefault(); zone.classList.remove("drag-over");
        const file = e.dataTransfer.files[0];
        if (file && file.type.includes("text") || /\.(js|py|java|cpp|c|html|css|txt|json|rb|go)$/i.test(file.name)) {
            const text = await file.text();
            getEl("codeInput").value = text;
            fileNameSpan.textContent = `📄 ${file.name}`;
            fileNameSpan.classList.add("pop-in");
            setTimeout(() => fileNameSpan.classList.remove("pop-in"), 400);
            showToast(`✅ ${file.name} cargado`, "success");
        } else { zone.classList.add("shake"); setTimeout(()=>zone.classList.remove("shake"),400); showToast("Formato no soportado", "error"); }
    });
    getEl("selectFileBtn").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async (e) => {
        if (fileInput.files.length) {
            const file = fileInput.files[0];
            const text = await file.text();
            getEl("codeInput").value = text;
            fileNameSpan.textContent = `📄 ${file.name}`;
            fileNameSpan.classList.add("pop-in");
        }
    });
}

// tema + localStorage
function toggleTheme() {
    const curr = document.documentElement.getAttribute("data-theme");
    const newTheme = curr === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    const btn = getEl("themeToggle");
    if (btn) btn.textContent = newTheme === "light" ? "🌙" : "☀️";
}
function restoreTheme() { const saved = localStorage.getItem("theme"); if (saved) document.documentElement.setAttribute("data-theme", saved); else document.documentElement.setAttribute("data-theme","dark"); }

// guardar API key
function setupApiKey() { 
    const input = getEl("apiKeyInput");
    const saved = localStorage.getItem("groq_api_key");
    if (saved) input.value = saved;
    input.addEventListener("blur", () => { localStorage.setItem("groq_api_key", input.value.trim()); showToast("🔐 API Key guardada", "info"); });
}

// config + inicialización
async function loadConfig() {
    try {
        const res = await fetch('config.json');
        const conf = await res.json();
        appConfig = { ...appConfig, ...conf };
        setText("modelBadge", `Modelo: ${appConfig.api_model}`);
    } catch(e) { console.warn("config fallback", e); setText("modelBadge", `Modelo: ${appConfig.api_model}`);}
}

// Eventos Centralizados + sparkles
function setupEventListeners() {
    getEl("analyzeBtn")?.addEventListener("click", (e) => { addSparkle(e); analyzeCode(); });
    getEl("optimizeBtn")?.addEventListener("click", (e) => { addSparkle(e); optimizeCode(); });
    getEl("generateBtn")?.addEventListener("click", (e) => { addSparkle(e); generateCode(); });
    getEl("themeToggle")?.addEventListener("click", toggleTheme);
    getEl("copyOptimizedBtn")?.addEventListener("click", () => { const txt = getEl("optimizationResult")?.innerText; if(txt) { navigator.clipboard.writeText(txt); showToast("Copiado optimización", "success"); } });
    getEl("downloadOptimizedBtn")?.addEventListener("click", () => { const txt = getEl("optimizationResult")?.innerText; if(txt) downloadFile("optimized_code.txt", txt); });
    getEl("copyGeneratedBtn")?.addEventListener("click", () => { const txt = getEl("generatedCodeResult")?.innerText; if(txt) navigator.clipboard.writeText(txt); showToast("Código copiado", "success"); });
    getEl("downloadGeneratedBtn")?.addEventListener("click", () => { const txt = getEl("generatedCodeResult")?.innerText; if(txt) downloadFile("generated_code.txt", txt); });
    getEl("exportAnalysisBtn")?.addEventListener("click", () => { const txt = getEl("analysisResult")?.innerText; if(txt) downloadFile("analysis_report.txt", txt); });
}
function downloadFile(name, content) { const blob = new Blob([content], {type: "text/plain"}); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href); }
// Particles
function initParticles() { const container = getEl("particles-container"); for(let i=0;i<10;i++) { const p = document.createElement("div"); p.classList.add("particle"); const size = Math.random() * 8 + 2; p.style.width = `${size}px`; p.style.height = `${size}px`; p.style.left = `${Math.random() * 100}%`; p.style.top = `${Math.random() * 100}%`; p.style.animationDuration = `${Math.random() * 10 + 8}s`; p.style.animationDelay = `${Math.random() * 5}s`; container?.appendChild(p); } }

// ciclo de vida
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    restoreTheme();
    setupApiKey();
    setupDragAndDrop();
    setupEventListeners();
    initParticles();
    updateScoreCircle(0);
    showToast("🧠 CodeMind AI listo — Analiza, optimiza y genera con IA", "info");
});