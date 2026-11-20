const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const api = async (p, body) => {
  const r = await fetch(p, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const j = await r.json(); if (!r.ok) throw j; return j;
};
const errText = (e) => (e.issues ? e.issues.map((i) => `${i.path}: ${i.message}`).join('\n') : e.erro ?? e.message ?? String(e));
const state = { campanha: null, filtro: 'todos' };

document.querySelectorAll('nav button').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll('nav button, .tab').forEach((x) => x.classList.remove('ativo'));
    b.classList.add('ativo');
    $('#' + b.dataset.tab).classList.add('ativo');
  }),
);
document.addEventListener('click', (e) => {
  const img = e.target.closest('img[data-zoom]');
  if (!img) return;
  const d = $('#zoom'); $('img', d).src = img.dataset.zoom; $('p', d).textContent = img.alt; d.showModal();
});

const showError = (el, e) => { el.innerHTML = `<div class="erro-box">${esc(e.erro ?? e.message ?? e)}</div>`; };

async function sistema() {
  const el = $('#sistema');
  try {
    const { campanha: c, ingest, papeis_por_layer } = await api('/api/campanha/' + state.campanha);
    const base = `/files/campaigns/${c.slug}/_ingest/`;
    const layers = ingest?.layers ?? [];
    el.innerHTML = `
      <h2>${esc(c.nome)} <span class="tag ${c.status === 'confirmado' ? 'ok' : 'alerta'}">${esc(c.status)}</span></h2>
      <div class="grid2">
        <div class="card">
          ${ingest ? `<img class="kv" src="${base}kv.jpg" data-zoom="${base}kv.jpg" alt="KV-mestre">
          <p style="color:var(--suave);font-size:12px;margin:8px 0 0">${esc(ingest.file)} · ${ingest.width}×${ingest.height} px · ${layers.length} layers</p>`
          : '<p class="vazio">KV ainda não ingerido. Rode <code>python3 tools/ingest_psd.py &lt;kv.psd&gt; ' + esc(c.slug) + '</code></p>'}
        </div>
        <div class="card">
          <h3 style="margin-top:0">Pendências</h3>
          <ul class="pend">${c.pendencias.map((p) => `<li>${esc(p)}</li>`).join('') || '<li>nenhuma</li>'}</ul>
          <h3>Regras de composição</h3>
          ${c.regras_composicao.length ? c.regras_composicao.map((r) => `
            <p><strong>${esc(r.nome)}</strong> ${r.confirmado ? '<span class="tag ok">confirmada</span>' : '<span class="tag alerta">a confirmar</span>'}<br>
            <span style="color:var(--suave);font-size:12px">fundo: ${esc(r.fundo.cor ?? r.fundo.papel)} · imagem: ${esc(r.imagem_principal)}${r.canto ? ' (' + esc(r.canto) + ')' : ''}
            · textos: ${esc((r.textos ?? []).join(', '))}<br>formatos: ${esc(r.formatos.join(', '))}</span></p>`).join('') : '<p class="vazio">nenhuma</p>'}
          <h3>Texto</h3>
          <p>Título: <strong>${esc(c.copy.titulo ?? '—')}</strong><br>Subtítulo: ${esc(c.copy.subtitulo ?? '—')}<br>CTA: ${esc(c.copy.cta ?? '—')}<br>
          Slogan: ${c.roles.logo?.slogan === false ? '<span class="tag">não aplicar</span>' : '<span class="tag azul">aplicar</span>'}</p>
        </div>
      </div>
      <div class="card">
        <h3 style="margin-top:0">Layers do KV → papéis no sistema visual</h3>
        ${layers.length ? `<table><thead><tr><th></th><th>#</th><th>Layer</th><th>Tipo</th><th>Bounds</th><th>Papel</th><th>Detalhe</th></tr></thead><tbody>
          ${[...layers].reverse().map((l) => `<tr>
            <td>${l.thumb ? `<img class="thumb" src="${base}${l.thumb}" data-zoom="${base}${l.thumb}" alt="${esc(l.name)}">` : ''}</td>
            <td>${l.index}</td><td>${esc(l.name)}</td><td><span class="tag">${esc(l.kind)}</span></td>
            <td style="font-size:12px;color:var(--suave)">${l.bbox.join(', ')}</td>
            <td>${(papeis_por_layer[l.index] ?? []).map((p) => `<span class="tag azul">${esc(p)}</span>`).join(' ') || '<span class="tag alerta">sem papel</span>'}</td>
            <td style="font-size:12px">${esc(l.text ?? l.smart_object?.filename ?? '')}${l.fonts ? '<br><span style="color:var(--suave)">' + esc(l.fonts.join(', ')) + '</span>' : ''}</td>
          </tr>`).join('')}</tbody></table>` : '<p class="vazio">sem layers</p>'}
      </div>`;
  } catch (e) { showError(el, e); }
}

async function formatos() {
  const el = $('#formatos');
  try {
    const rows = await api('/api/catalogo?campanha=' + state.campanha);
    const secoes = ['todos', ...new Set(rows.map((r) => r.secao))];
    const vis = rows.filter((r) => state.filtro === 'todos' || r.secao === state.filtro);
    const n = (s) => rows.filter((r) => r.status === s).length;
    el.innerHTML = `
      <h2>Formatos <span class="tag">${rows.length}</span> <span class="tag ok">${n('rascunho')} com prévia</span> <span class="tag">${n('pendente')} pendentes</span></h2>
      <div class="card">
        <h3 style="margin-top:0">Peças-diretriz</h3>
        <p style="margin:0 0 10px;color:var(--suave);font-size:12px">Poucas composições de referência; cada formato é derivado da diretriz do seu arquétipo.</p>
        <div class="diretrizes">${[...new Set(rows.map((r) => r.diretriz).filter(Boolean))].map((id) => {
          const d = rows.find((r) => r.id === id); const filhos = rows.filter((r) => r.diretriz === id && r.id !== id);
          return `<div><strong>${esc(d?.titulo ?? id)}</strong><small>${esc(d?.arquetipo ?? '')}</small><small>${filhos.length} formatos derivados</small></div>`;
        }).join('')}</div>
      </div>
      <details class="card" id="novo-tamanho">
        <summary><strong>+ Novo tamanho</strong> <span style="color:var(--suave);font-size:12px">copia as especificações de um formato existente</span></summary>
        <form class="form" style="margin-top:12px">
          <div class="linha">
            <label>Baseado em <select name="base" required>${rows.map((r) => `<option value="${esc(r.id)}"${r.id === state.base ? ' selected' : ''}>${esc(r.titulo)}</option>`).join('')}</select></label>
            <label>Nome na apresentação <input name="nome_apresentacao" required placeholder="Ex.: Lona" /></label>
          </div>
          <div class="linha">
            <label>Largura <input name="w" type="number" step="any" min="0.1" required /></label>
            <label>Altura <input name="h" type="number" step="any" min="0.1" required /></label>
            <label>Unidade <input name="un" disabled /></label>
            <label>Faces <select name="faces"><option value="">igual à base</option><option value="1">1</option><option value="2">2 (frente e verso)</option></select></label>
            <label>Id (opcional) <input name="id" placeholder="gerado automaticamente" /></label>
          </div>
          <p class="msg"></p>
          <div class="acoes"><button class="primario">Cadastrar</button></div>
        </form>
      </details>
      <div class="filtros">${secoes.map((s) => `<button data-f="${esc(s)}" class="${s === state.filtro ? 'ativo' : ''}">${esc(s)}</button>`).join('')}</div>
      <div class="card" style="padding:0;overflow:auto"><table><thead><tr>
        <th>Peça</th><th>Arquétipo / diretriz</th><th>App / cor</th><th>Documento</th><th>Escala</th><th>Sangria</th><th>ppi dos links</th><th>Caixa-alta mín.</th><th>Regra</th><th>Prévia</th><th>Status</th>
      </tr></thead><tbody>${vis.map((r) => `<tr>
        <td><strong>${esc(r.titulo)}</strong><br><span style="font-size:11px;color:var(--suave)">${esc(r.id)} · ${esc(r.saidas.join(', '))}${r.limite ? ' · ≤ ' + esc(r.limite) : ''}${r.faca ? ' · faca ' + esc(r.faca) : ''}</span></td>
        <td><span class="tag">${esc(r.arquetipo)}</span><br><span style="font-size:11px;color:var(--suave)">${r.e_diretriz ? '<span class="tag azul">diretriz</span>' : '← ' + esc(r.diretriz ?? '—')}</span></td>
        <td>${esc(r.app)} <span class="tag ${r.cor === 'cmyk' ? 'laranja' : 'azul'}">${esc(r.cor.toUpperCase())}</span></td>
        <td>${esc(r.documento)}</td><td>${esc(r.escala)}</td><td>${esc(r.sangria ?? '—')}</td><td style="font-size:12px">${esc(r.ppi ?? '—')}${r.ppi_alerta ? `<br><span class="tag alerta" title="${esc(r.ppi_alerta)}">ver de perto</span>` : ''}</td><td>${esc(r.caixa_alta ?? '—')}</td>
        <td style="font-size:12px">${esc(r.regra ?? '—')}</td>
        <td>${r.previas.length ? `<img class="prev" src="${r.previas.at(-1)}" data-zoom="${r.previas.at(-1)}" alt="${esc(r.titulo)}">` : '—'}</td>
        <td><span class="tag ${r.status === 'rascunho' ? 'alerta' : ''}">${esc(r.status)}</span></td>
      </tr>`).join('')}</tbody></table></div>`;
    el.querySelectorAll('.filtros button').forEach((b) => b.addEventListener('click', () => { state.filtro = b.dataset.f; formatos(); }));
    const form = $('#novo-tamanho form', el);
    const syncUn = () => { const r = rows.find((x) => x.id === form.base.value); form.un.value = r?.unidade ?? ''; };
    form.base.addEventListener('change', syncUn); syncUn();
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const msg = $('.msg', form); msg.className = 'msg'; msg.textContent = 'Cadastrando…';
      const d = Object.fromEntries(new FormData(form));
      state.base = d.base;
      try {
        const r = await api('/api/formatos', { base: d.base, nome_apresentacao: d.nome_apresentacao, w: Number(d.w), h: Number(d.h), faces: d.faces || undefined, id: d.id || undefined });
        await formatos();
        const m = $('#novo-tamanho .msg'); $('#novo-tamanho').open = true; m.className = 'msg ok'; m.textContent = `✓ "${r.formato.id}" cadastrado.`;
      } catch (e) { msg.className = 'msg erro'; msg.textContent = errText(e); }
    });
  } catch (e) { showError(el, e); }
}

async function previas() {
  const el = $('#previas');
  try {
    const rows = (await api('/api/catalogo?campanha=' + state.campanha)).filter((r) => r.previas.length);
    el.innerHTML = `<h2>Prévias</h2>` + (rows.length ? `<div class="galeria">${rows.flatMap((r) => [...r.previas].reverse().map((p) => `
      <figure><img src="${p}" data-zoom="${p}" alt="${esc(r.titulo)}"><figcaption><strong>${esc(r.titulo)}</strong> · ${esc(p.split('/').pop())}</figcaption></figure>`)).join('')}</div>`
      : '<p class="vazio">Nenhuma prévia gerada para esta campanha.</p>');
  } catch (e) { showError(el, e); }
}

async function marca() {
  const el = $('#marca');
  try {
    const b = await api('/api/marca/tumelero');
    el.innerHTML = `<h2>${esc(b.nome)} <span class="tag">${esc(b.fonte_miv)}</span></h2>
      <div class="card"><h3 style="margin-top:0">Cores</h3><div class="cores">${Object.entries(b.cores).map(([n, c]) => `
        <div class="cor"><div style="background:${c.hex}${c.hex === '#FFFFFF' ? ';border-bottom:1px solid var(--borda)' : ''}"></div>
        <p><strong>${esc(n)}</strong> ${c.proporcao ? '· ' + c.proporcao + '%' : ''}<br>${esc(c.pantone ?? '—')}<br>CMYK ${c.cmyk.join('-')}<br>RGB ${c.rgb.join('-')} · ${c.hex}</p></div>`).join('')}</div></div>
      <div class="card"><h3 style="margin-top:0">Tipografia</h3><p><strong>${esc(b.tipografia.familia)}</strong> — ${esc(b.tipografia.estilos_permitidos.join(', '))}</p></div>
      <div class="card"><h3 style="margin-top:0">Logo</h3>
        <table><thead><tr><th>Variante</th><th>Lettering</th><th>Casa</th><th>Fundos</th></tr></thead><tbody>
        ${Object.entries(b.logo.variantes_cor).map(([n, v]) => `<tr><td>${esc(n)}</td><td>${esc(v.lettering)}</td><td>${esc(v.casa)}</td><td>${esc(v.fundos.join(', '))}</td></tr>`).join('')}</tbody></table>
        <h3>Versão por arquétipo</h3>
        <table><tbody>${Object.entries(b.logo.por_arquetipo).map(([a, r]) => `<tr><td>${esc(a)}</td><td>${esc(r.permitidas.join(' / '))}${r.preferida ? ' · preferida: ' + esc(r.preferida) : ''}</td></tr>`).join('')}</tbody></table>
        <p style="color:var(--suave);font-size:12px">${b.logo.arquivos.length ? b.logo.arquivos.length + ' arquivos oficiais' : 'Arquivos oficiais ainda não extraídos do MIV (precisa do InDesign).'}</p></div>
      <div class="card"><h3 style="margin-top:0">Linguagem</h3>
        <p>Tratamento: <strong>${esc(b.linguagem.tratamento)}</strong> · alerta para: ${esc(b.linguagem.pronomes_alerta.join(', '))}</p>
        <p>Nunca:</p><ul class="pend">${b.linguagem.frases_proibidas.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>`;
  } catch (e) { showError(el, e); }
}

function novaCampanha() {
  const d = $('#dlg-campanha'), form = $('#form-campanha'), msg = $('.msg', form);
  $('#nova-campanha').addEventListener('click', () => { form.reset(); msg.textContent = ''; d.showModal(); });
  form.addEventListener('submit', async (ev) => {
    if (ev.submitter?.value !== 'ok') return;
    ev.preventDefault();
    msg.className = 'msg'; msg.textContent = 'Criando…';
    try {
      const r = await api('/api/campanhas', Object.fromEntries(new FormData(form)));
      d.close(); await iniciar(r.campanha.slug);
    } catch (e) { msg.className = 'msg erro'; msg.textContent = errText(e); }
  });
}

async function carregar() { await Promise.all([sistema(), formatos(), previas()]); }

async function iniciar(slug) {
  const sel = $('#campanha');
  const camps = await api('/api/campanhas');
  sel.innerHTML = camps.map((c) => `<option value="${esc(c.slug)}">${esc(c.nome ?? c.slug)}${c.ok ? '' : ' (erro)'}</option>`).join('');
  state.campanha = slug ?? camps.find((c) => c.slug === 'verao-2026')?.slug ?? camps[0]?.slug;
  sel.value = state.campanha;
  carregar();
}

$('#campanha').addEventListener('change', (e) => { state.campanha = e.target.value; carregar(); });
novaCampanha();
marca();
iniciar();
