document.addEventListener('DOMContentLoaded', () => {
  // NAV / SECTION SWITCH
  const navBtns = document.querySelectorAll('.nav-btn');
  const pages = document.querySelectorAll('.page');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.target;
      pages.forEach(p => p.classList.toggle('show', p.id === target));
    });
  });

  // OPEN / CLOSE FORMS
  const openBtns = document.querySelectorAll('.open-form');
  openBtns.forEach(b => {
    b.addEventListener('click', () => {
      const formId = b.dataset.form;
      document.querySelectorAll('.add-form').forEach(f => {
        f.classList.remove('show');
        // clear editing state when opening forms normally
        delete f.dataset.editing;
      });
      const f = document.getElementById(formId);
      if (f) { f.classList.add('show'); f.querySelector('input,textarea')?.focus(); }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // Cancel buttons just hide the form and clear edit state
  document.querySelectorAll('.js-cancel').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const form = e.target.closest('.add-form');
      if (form) { form.reset(); form.classList.remove('show'); delete form.dataset.editing; }
    });
  });

  // Utility: safe JSON fetch helper
  async function apiFetch(path, opts = {}) {
    const resp = await fetch(path, opts);
    let json = null;
    try { json = await resp.json(); } catch (e) { /* ignore */ }
    if (!resp.ok) {
      const err = (json && json.error) ? json.error : `HTTP ${resp.status}`;
      throw new Error(err);
    }
    return json;
  }

  // Render helpers
  function makeCard(section, item) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = item.id;

    const title = item.title || item.job_title || item.subject || 'Untitled';
    let metaHtml = '';
    if (section === 'todo') {
      metaHtml = `<div style="margin-top:8px;color:var(--muted);font-size:0.92rem">
        ${item.description ? `<div>${escapeHtml(item.description)}</div>` : ''}
        <div style="margin-top:6px">Status: ${item.completed ? 'Done' : 'Pending'}</div>
      </div>`;
    } else if (section === 'links') {
      metaHtml = `<div style="margin-top:8px;color:var(--muted);font-size:0.92rem">
        ${item.description ? `<div>${escapeHtml(item.description)}</div>` : ''}
        ${item.url ? `<div style="margin-top:6px"><a href="${escapeAttr(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.url)}</a></div>` : ''}
      </div>`;
    } else if (section === 'assignments') {
      metaHtml = `<div style="margin-top:8px;color:var(--muted);font-size:0.92rem">
        <div>${item.subject ? `<strong>${escapeHtml(item.subject)}</strong>` : ''} ${item.title ? escapeHtml(item.title) : ''}</div>
        ${item.description ? `<div style="margin-top:6px">${escapeHtml(item.description)}</div>` : ''}
        ${item.due ? `<div style="margin-top:6px">Due: ${escapeHtml(item.due)}</div>` : ''}
      </div>`;
    } else if (section === 'jobs') {
      metaHtml = `<div style="margin-top:8px;color:var(--muted);font-size:0.92rem">
        <div><strong>${escapeHtml(item.job_title || '')}</strong> • ${escapeHtml(item.company || '')}</div>
        ${item.requirements ? `<div style="margin-top:6px">${escapeHtml(item.requirements)}</div>` : ''}
      </div>`;
    }

    let controlsHtml = `<div style="display:flex; gap:8px; margin-top:10px">
      <button class="btn ghost js-edit" data-id="${item.id}" data-section="${section}" type="button">Edit</button>
      <button class="btn ghost js-delete" data-id="${item.id}" data-section="${section}" type="button">Delete</button>
    </div>`;

    if (section === 'todo') {
      controlsHtml = `<div style="display:flex; gap:8px; margin-top:10px">
        <button class="btn ghost js-toggle" data-id="${item.id}" data-section="${section}" type="button">${item.completed ? 'Mark Pending' : 'Mark Done'}</button>
        <button class="btn ghost js-edit" data-id="${item.id}" data-section="${section}" type="button">Edit</button>
        <button class="btn ghost js-delete" data-id="${item.id}" data-section="${section}" type="button">Delete</button>
      </div>`;
    }

    card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:start;">
        <div style="flex:1">
          <div style="font-weight:700; color:var(--accent-2);">${escapeHtml(title)}</div>
          ${metaHtml}
        </div>
      </div>
      ${controlsHtml}
    `;

    card.querySelectorAll('.js-delete').forEach(b => {
      b.addEventListener('click', async (ev) => {
        const id = parseInt(b.dataset.id, 10);
        const sec = b.dataset.section;
        if (!confirm('Delete this item?')) return;
        try {
          await apiFetch(`/api/${sec}/${id}`, { method: 'DELETE' });
          card.remove();
          // ✅ FIX: use correct ID for assignments
          const listId = sec === 'assignments' ? 'assignList' : sec + 'List';
          const list = document.getElementById(listId);
          if (!list.querySelector('.card')) {
            insertPlaceholder(list, sec);
          }
        } catch (err) {
          alert('Delete failed: ' + err.message);
        }
      });
    });

    card.querySelectorAll('.js-edit').forEach(b => {
      b.addEventListener('click', (ev) => {
        const id = parseInt(b.dataset.id, 10);
        const sec = b.dataset.section;
        openEditForm(sec, id);
      });
    });

    card.querySelectorAll('.js-toggle').forEach(b => {
      b.addEventListener('click', async (ev) => {
        const id = parseInt(b.dataset.id, 10);
        const sec = b.dataset.section;
        try {
          await apiFetch(`/api/${sec}/${id}/toggle`, { method: 'POST' });
          await loadSection(sec);
        } catch (err) {
          alert('Toggle failed: ' + err.message);
        }
      });
    });

    return card;
  }

  function insertPlaceholder(listEl, section) {
    const ph = document.createElement('div');
    ph.className = 'placeholder';
    if (section === 'todo') ph.textContent = 'No tasks yet — add one using the blue + Add button.';
    else if (section === 'links') ph.textContent = 'No saved links yet.';
    else if (section === 'assignments') ph.textContent = 'No assignments yet.';
    else if (section === 'jobs') ph.textContent = 'No job applications yet.';
    listEl.innerHTML = '';
    listEl.appendChild(ph);
  }

  async function loadSection(section) {
    try {
      const json = await apiFetch(`/api/${section}`);
      const items = json.items || [];
      const listId = section === 'assignments' ? 'assignList' : section + 'List'; // ✅ FIX
      const list = document.getElementById(listId);
      list.innerHTML = '';
      if (!items.length) {
        insertPlaceholder(list, section);
        return;
      }
      items.forEach(it => {
        const card = makeCard(section, it);
        list.appendChild(card);
      });
    } catch (err) {
      console.error('Failed to load', section, err);
    }
  }

  ['todo','links','assignments','jobs'].forEach(s => loadSection(s));

  async function openEditForm(section, id) {
    const formId = {
      todo: 'todoForm',
      links: 'linksForm',
      assignments: 'assignForm',
      jobs: 'jobsForm'
    }[section];
    const form = document.getElementById(formId);
    if (!form) return;
    try {
      const res = await apiFetch(`/api/${section}/${id}`);
      const item = res.item;
      if (section === 'todo') {
        form.querySelector('[name=title]').value = item.title || '';
        form.querySelector('[name=description]').value = item.description || '';
      } else if (section === 'links') {
        form.querySelector('[name=title]').value = item.title || '';
        form.querySelector('[name=description]').value = item.description || '';
        form.querySelector('[name=link]').value = item.url || '';
      } else if (section === 'assignments') {
        form.querySelector('[name=subject]').value = item.subject || '';
        form.querySelector('[name=title]').value = item.title || '';
        form.querySelector('[name=description]').value = item.description || '';
        const dueInput = form.querySelector('[name=due]');
        if (dueInput) dueInput.value = item.due || '';
      } else if (section === 'jobs') {
        form.querySelector('[name=job_title]').value = item.job_title || '';
        form.querySelector('[name=company]').value = item.company || '';
        form.querySelector('[name=requirements]').value = item.requirements || '';
        form.querySelector('[name=you_do]').value = item.you_do || '';
      }
      form.dataset.editing = id;
      document.querySelectorAll('.add-form').forEach(f => f.classList.remove('show'));
      form.classList.add('show');
      form.querySelector('input, textarea')?.focus();
    } catch (err) {
      alert('Failed to load item for edit: ' + err.message);
    }
  }

  document.querySelectorAll('.js-save').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const form = e.target.closest('.add-form');
      if (!form) return;

      const required = Array.from(form.querySelectorAll('[required]'));
      const ok = required.every(inp => inp.value && inp.value.trim() !== '');
      if (!ok) {
        form.animate(
          [{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
          { duration: 220 }
        );
        return;
      }

      const section = form.dataset.section;
      const formData = Object.fromEntries(new FormData(form).entries());

      try {
        if (form.dataset.editing) {
          const id = parseInt(form.dataset.editing, 10);
          await apiFetch(`/api/${section}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });
          await loadSection(section);
          form.reset();
          form.classList.remove('show');
          delete form.dataset.editing;
        } else {
          const res = await apiFetch(`/api/${section}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });
          const listId = section === 'assignments' ? 'assignList' : section + 'List'; // ✅ FIX
          const list = document.getElementById(listId);
          list.querySelector('.placeholder')?.remove();
          const card = makeCard(section, res.item);
          list.appendChild(card);
          form.reset();
          form.classList.remove('show');
        }
      } catch (err) {
        alert('Save failed: ' + err.message);
      }
    });
  });

  function escapeHtml(s) {
    if (!s && s !== 0) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  const y = new Date().getFullYear();
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = y;
});
