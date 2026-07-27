// Memória global da aplicação
let notasExtraidasDoXml = []; 
let ultimasNotasConferidas = []; 

const xmlFileInput = document.getElementById('xmlFile');
const dropArea = document.getElementById('dropArea');
const chaveBipadaInput = document.getElementById('chaveBipada');
const errorBox = document.getElementById('errorBox');
const resultBox = document.getElementById('resultBox');
const historyBox = document.getElementById('historyBox');
const listaHistorico = document.getElementById('listaHistorico');
const btnReiniciar = document.getElementById('btnReiniciar');

dropArea.addEventListener('click', () => xmlFileInput.click());
btnReiniciar.addEventListener('click', limparTudo);

xmlFileInput.addEventListener('change', function(e) {
    const files = e.target.files;
    errorBox.style.display = 'none';
    resultBox.style.display = 'none';
    historyBox.style.display = 'none';
    notasExtraidasDoXml = []; 
    ultimasNotasConferidas = [];
    listaHistorico.innerHTML = '';
    chaveBipadaInput.value = '';

    if (!files || files.length === 0) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const xmlText = evt.target.result;
            
            // --- 1. CAPTURA DO NÚMERO DE CHAVE DO CT-E ---
            let chaveCte = "Não encontrada";
            const regexChCte = /<[^>]*chCTe[^>]*>([0-9]{44})<\/[^>]*chCTe>/i;
            const matchCte = xmlText.match(regexChCte);
            if (matchCte) chaveCte = matchCte[1];

            // --- 2. EXTRAÇÃO DAS NOTAS FISCAIS DO XML (<infNFe>) ---
            const regexBlocoNfe = /<[^>]*infNFe[^>]*>([\s\S]*?)<\/([^>]*infNFe)>/gi;
            let blocoMatch;
            
            while ((blocoMatch = regexBlocoNfe.exec(xmlText)) !== null) {
                const conteudoBloco = blocoMatch[1];
                const regexChave44 = /[0-9]{44}/g;
                let chaveMatch = conteudoBloco.match(regexChave44);
                
                if (chaveMatch) {
                    chaveMatch.forEach(chaveCompleta => {
                        const fragmentoNota = chaveCompleta.substring(28, 35);
                        const notaLimpa = fragmentoNota.trim(); 
                        if (notaLimpa && !notasExtraidasDoXml.includes(notaLimpa)) {
                            notasExtraidasDoXml.push(notaLimpa);
                        }
                    });
                }
            }

            // --- 3. EXTRAÇÃO DE VOLUMES ---
            let totalVolumes = 0;
            let achouTagVolume = false;
            const regexQVol = /<[^>]*qVol[^>]*>([^<]+)<\/[^>]*qVol>/gi;
            let matchVol;
            while ((matchVol = regexQVol.exec(xmlText)) !== null) {
                achouTagVolume = true;
                let val = parseFloat(matchVol[1].trim() || 0);
                if (!isNaN(val)) totalVolumes += val;
            }

            let exibicaoVolumes = achouTagVolume ? totalVolumes.toString() : "0 (Não declarado)";

            document.getElementById('chaveCte').textContent = chaveCte;
            document.getElementById('qtdVolumes').textContent = exibicaoVolumes;
            
            renderizarNotas();
            atualizarContadorVisual(); // Inicializa o contador com zero
            resultBox.style.display = 'block';

        } catch (error) {
            errorBox.textContent = "Erro ao processar o arquivo XML: " + error.message;
            errorBox.style.display = 'block';
        }
    };
    
    reader.readAsText(files[0]);
});

chaveBipadaInput.addEventListener('input', function() {
    const valorCampo = chaveBipadaInput.value.trim();
    const chaveApenasNumeros = valorCampo.replace(/\D/g, '');

    if (chaveApenasNumeros.length === 44) {
        errorBox.style.display = 'none'; 

        const fragmentoBipe = chaveApenasNumeros.substring(27, 34);
        const numeroNotaMapeado = fragmentoBipe.trim();
        const numeroNormalizadoBipe = numeroNotaMapeado.replace(/^0+/, '');

        if (ultimasNotasConferidas.includes(numeroNormalizadoBipe)) {
            errorBox.textContent = `⚠️ Atenção: A nota fiscal ${numeroNotaMapeado} já foi lida e conferida anteriormente!`;
            errorBox.style.display = 'block';
            
            chaveBipadaInput.value = '';
            chaveBipadaInput.focus();
            return; 
        }

        const notaExisteNoXml = notasExtraidasDoXml.some(notaXml => {
            return notaXml.replace(/^0+/, '') === numeroNormalizadoBipe;
        });

        if (notaExisteNoXml) {
            ultimasNotasConferidas.push(numeroNormalizadoBipe);
            adicionarAoHistoricoVisual(chaveApenasNumeros, numeroNotaMapeado);
        } else {
            errorBox.textContent = `❌ Erro: A nota ${numeroNotaMapeado} não pertence a este arquivo XML!`;
            errorBox.style.display = 'block';
        }

        atualizarStatusConferencia();
        atualizarContadorVisual(); // Atualiza a contagem após o bipe

        setTimeout(() => {
            chaveBipadaInput.value = '';
            chaveBipadaInput.focus();
        }, 150);
    }
});

function renderizarNotas() {
    const listaNotasDiv = document.getElementById('listaNotas');
    listaNotasDiv.innerHTML = '';

    if (notasExtraidasDoXml.length > 0) {
        notasExtraidasDoXml.forEach(nota => {
            const notaXmlNormalizada = nota.replace(/^0+/, '').trim();

            const span = document.createElement('span');
            span.className = 'badge falta-conferencia';
            span.id = "badge-xml-" + notaXmlNormalizada;
            span.textContent = "NF-e: " + nota + " (Falta Conferência)";
            listaNotasDiv.appendChild(span);
        });
    } else {
        listaNotasDiv.innerHTML = '<span style="color:#64748b; font-style:italic;">Nenhuma nota localizada no XML</span>';
    }
}

function atualizarStatusConferencia() {
    notasExtraidasDoXml.forEach(notaXml => {
        const notaXmlNormalizada = notaXml.replace(/^0+/, '').trim();
        const foiConferida = ultimasNotasConferidas.includes(notaXmlNormalizada);

        const elementoBadge = document.getElementById("badge-xml-" + notaXmlNormalizada);
        if (elementoBadge) {
            if (foiConferida) {
                elementoBadge.className = 'badge conferida';
                elementoBadge.textContent = "NF-e: " + notaXml; 
            } else {
                elementoBadge.className = 'badge falta-conferencia';
                elementoBadge.textContent = "NF-e: " + notaXml + " (Falta Conferência)";
            }
        }
    });
}

// NOVA FUNÇÃO: Calcula a matemática do progresso e atualiza os elementos visuais
function atualizarContadorVisual() {
    const totalNotas = notasExtraidasDoXml.length;
    const totalConferidas = ultimasNotasConferidas.length;
    
    // Atualiza o texto descritivo
    document.getElementById('txtContador').textContent = `Conferidas: ${totalConferidas} de ${totalNotas}`;
    
    // Calcula a percentagem e move a barra verde
    const percentagem = totalNotas > 0 ? (totalConferidas / totalNotas) * 100 : 0;
    document.getElementById('barProgresso').style.width = `${percentagem}%`;
}

function adicionarAoHistoricoVisual(chaveCompleta, notaExtraida) {
    historyBox.style.display = 'block';
    const li = document.createElement('li');
    li.className = 'history-item';
    li.innerHTML = `
        <span class="chave-original">${chaveCompleta}</span>
        <span class="nota-extraida">Lida: ${notaExtraida}</span>
    `;
    listaHistorico.insertBefore(li, listaHistorico.firstChild);
}

function limparTudo() {
    notasExtraidasDoXml = [];
    ultimasNotasConferidas = [];
    errorBox.style.display = 'none';
    resultBox.style.display = 'none';
    historyBox.style.display = 'none';
    listaHistorico.innerHTML = '';
    chaveBipadaInput.value = '';
    xmlFileInput.value = ''; 
    
    // Zera o contador na limpeza
    document.getElementById('txtContador').textContent = 'Conferidas: 0 de 0';
    document.getElementById('barProgresso').style.width = '0%';
    
    chaveBipadaInput.focus();
}
