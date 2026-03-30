import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import { PlatformLayout } from "./layout";
import type { BlogPostView } from "../../db/queries/blog";
import { toBrazilDateTime } from "../../lib/timezone";

interface PlatformBlogProps {
	posts: BlogPostView[];
	user: { name: string; email: string } | null;
}

export const PlatformBlog: FC<PlatformBlogProps> = ({ posts, user }) => {
	const script = html`<script>${raw(`
function showCreate() { document.getElementById('modal').classList.remove('hidden'); setMode('create'); }
function hideModal() { document.getElementById('modal').classList.add('hidden'); }

function setMode(mode, post) {
	var form = document.getElementById('blog-form');
	var title = document.getElementById('modal-title');
	var btnText = document.getElementById('btn-text');
	form.reset();
	document.getElementById('edit-id').value = '';
	document.getElementById('sections-json').value = '[]';
	renderSections([]);

	if (mode === 'edit' && post) {
		title.textContent = 'Editar Post';
		btnText.textContent = 'Salvar alterações';
		document.getElementById('edit-id').value = post.id;
		document.getElementById('f-title').value = post.title;
		document.getElementById('f-slug').value = post.slug;
		document.getElementById('f-description').value = post.description;
		document.getElementById('f-icon').value = post.icon;
		document.getElementById('f-reading-time').value = post.reading_time;
		document.getElementById('f-cta-text').value = post.cta_text || '';
		document.getElementById('f-cta-href').value = post.cta_href || '';
		document.getElementById('f-published').checked = !!post.published;
		var sections = typeof post.sections === 'string' ? JSON.parse(post.sections) : post.sections;
		document.getElementById('sections-json').value = JSON.stringify(sections);
		renderSections(sections);
	} else {
		title.textContent = 'Novo Post';
		btnText.textContent = 'Criar post';
	}
}

function renderSections(sections) {
	var container = document.getElementById('sections-list');
	container.innerHTML = '';
	sections.forEach(function(s, i) {
		var div = document.createElement('div');
		div.className = 'bg-sk-bg rounded-sk p-4 border border-sk-border/50';
		div.innerHTML = '<div class="flex items-center justify-between mb-2">' +
			'<span class="font-display font-bold text-sm text-sk-text">Seção ' + (i + 1) + '</span>' +
			'<button type="button" onclick="removeSection(' + i + ')" class="text-sk-danger text-xs hover:underline">Remover</button>' +
			'</div>' +
			'<input type="text" value="' + escapeAttr(s.heading) + '" onchange="updateSection(' + i + ',\\'heading\\',this.value)" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm mb-2" placeholder="Título da seção" />' +
			'<textarea onchange="updateSection(' + i + ',\\'content\\',this.value)" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm h-32" placeholder="Conteúdo HTML">' + escapeHtml(s.content) + '</textarea>';
		container.appendChild(div);
	});
}

function escapeAttr(str) { return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function escapeHtml(str) { return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function getSections() {
	try { return JSON.parse(document.getElementById('sections-json').value); } catch(e) { return []; }
}

function updateSection(i, field, value) {
	var sections = getSections();
	if (sections[i]) { sections[i][field] = value; }
	document.getElementById('sections-json').value = JSON.stringify(sections);
}

function removeSection(i) {
	var sections = getSections();
	sections.splice(i, 1);
	document.getElementById('sections-json').value = JSON.stringify(sections);
	renderSections(sections);
}

function addSection() {
	var sections = getSections();
	sections.push({ heading: '', content: '' });
	document.getElementById('sections-json').value = JSON.stringify(sections);
	renderSections(sections);
}

function submitPost(e) {
	e.preventDefault();
	var btn = document.getElementById('submit-btn');
	btn.disabled = true;
	btn.textContent = 'Salvando...';

	var editId = document.getElementById('edit-id').value;
	var data = {
		title: document.getElementById('f-title').value.trim(),
		slug: document.getElementById('f-slug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
		description: document.getElementById('f-description').value.trim(),
		icon: document.getElementById('f-icon').value.trim() || '📝',
		reading_time: document.getElementById('f-reading-time').value.trim() || '5 min de leitura',
		sections: getSections(),
		cta_text: document.getElementById('f-cta-text').value.trim() || null,
		cta_href: document.getElementById('f-cta-href').value.trim() || null,
		published: document.getElementById('f-published').checked
	};

	var url = editId ? '/api/platform/blog/' + editId : '/api/platform/blog';
	var method = editId ? 'PUT' : 'POST';

	fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
		.then(function(r) {
			if (r.ok) { showToast(editId ? 'Post atualizado' : 'Post criado'); location.reload(); }
			else { r.json().then(function(d) { alert(d.error || 'Erro'); }); }
		})
		.catch(function() { alert('Erro de conexão'); })
		.finally(function() { btn.disabled = false; btn.textContent = editId ? 'Salvar alterações' : 'Criar post'; });
}

function editPost(id) {
	var post = window.__BLOG_POSTS__.find(function(p) { return p.id === id; });
	if (post) { document.getElementById('modal').classList.remove('hidden'); setMode('edit', post); }
}

function togglePublish(id, current) {
	fetch('/api/platform/blog/' + id, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ published: !current })
	}).then(function(r) {
		if (r.ok) { showToast(current ? 'Post despublicado' : 'Post publicado'); location.reload(); }
	});
}

function deletePost(id) {
	if (!confirm('Excluir este post permanentemente?')) return;
	fetch('/api/platform/blog/' + id, { method: 'DELETE' })
		.then(function(r) { if (r.ok) { showToast('Post excluído'); location.reload(); } });
}

function uploadImage(postId) {
	var input = document.createElement('input');
	input.type = 'file';
	input.accept = 'image/jpeg,image/png,image/webp';
	input.onchange = function() {
		var file = input.files[0];
		if (!file) return;
		if (file.size > 2 * 1024 * 1024) { alert('Máximo 2MB'); return; }
		var form = new FormData();
		form.append('image', file);
		fetch('/api/platform/blog/' + postId + '/image', { method: 'POST', body: form })
			.then(function(r) { return r.json(); })
			.then(function(d) {
				if (d.cover_image_url) { showToast('Imagem enviada'); location.reload(); }
				else { alert(d.error || 'Erro'); }
			});
	};
	input.click();
}

function generateSlug() {
	var title = document.getElementById('f-title').value;
	var slug = title.toLowerCase()
		.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
		.replace(/[^a-z0-9\\s-]/g, '').replace(/\\s+/g, '-').replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
	document.getElementById('f-slug').value = slug;
}
`)}</script>`;

	const dataScript = html`<script>
window.__BLOG_POSTS__ = ${raw(JSON.stringify(posts.map((p) => ({
		id: p.id, title: p.title, slug: p.slug, description: p.description,
		icon: p.icon, reading_time: p.reading_time, sections: p.sections,
		cta_text: p.cta_text, cta_href: p.cta_href, published: p.published,
	}))))};
</script>`;

	const createButton = html`
		<button onclick="showCreate()" class="bg-sk-blue hover:bg-sk-blue-dark text-white px-4 py-2.5 rounded-sk text-sm font-medium font-display transition-colors shadow-sk-sm">
			+ Novo Post
		</button>
	`;

	return (
		<PlatformLayout
			title="Blog"
			user={user}
			breadcrumb={[{ label: "Dashboard", href: "/platform" }, { label: "Blog" }]}
			actions={createButton}
			bodyScripts={html`${dataScript}${script}`}
		>
			{/* Stats */}
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
				<div class="bg-sk-surface rounded-sk p-4 border border-sk-border/50 shadow-sk-sm">
					<p class="text-2xl font-display font-bold text-sk-text">{posts.length}</p>
					<p class="text-xs font-body text-sk-muted">Total</p>
				</div>
				<div class="bg-sk-surface rounded-sk p-4 border border-sk-border/50 shadow-sk-sm">
					<p class="text-2xl font-display font-bold text-sk-green">{posts.filter((p) => p.published).length}</p>
					<p class="text-xs font-body text-sk-muted">Publicados</p>
				</div>
				<div class="bg-sk-surface rounded-sk p-4 border border-sk-border/50 shadow-sk-sm">
					<p class="text-2xl font-display font-bold text-sk-orange">{posts.filter((p) => !p.published).length}</p>
					<p class="text-xs font-body text-sk-muted">Rascunhos</p>
				</div>
				<div class="bg-sk-surface rounded-sk p-4 border border-sk-border/50 shadow-sk-sm">
					<p class="text-2xl font-display font-bold text-sk-blue">{posts.reduce((a, p) => a + p.sections.length, 0)}</p>
					<p class="text-xs font-body text-sk-muted">Seções</p>
				</div>
			</div>

			{/* Posts table */}
			<div class="bg-sk-surface rounded-sk-lg shadow-sk-sm border border-sk-border/50 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm font-body">
						<thead>
							<tr class="bg-sk-bg text-left">
								<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase">Post</th>
								<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase hidden md:table-cell">Slug</th>
								<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase">Status</th>
								<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase hidden md:table-cell">Seções</th>
								<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase hidden md:table-cell">Atualizado</th>
								<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase text-right">Ações</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-sk-border/30">
							{posts.length === 0 && (
								<tr><td colspan={6} class="px-4 py-8 text-center text-sk-muted">Nenhum post criado ainda</td></tr>
							)}
							{posts.map((post) => (
								<tr class="hover:bg-sk-blue-light/20 transition-colors">
									<td class="px-4 py-3">
										<div class="flex items-center gap-2">
											{post.cover_image_url ? (
												<img src={post.cover_image_url} alt="" class="w-8 h-8 rounded object-cover" />
											) : (
												<span class="text-lg">{post.icon}</span>
											)}
											<div>
												<p class="font-display font-bold text-sk-text text-sm">{post.title}</p>
												<p class="text-xs text-sk-muted truncate max-w-xs">{post.description}</p>
											</div>
										</div>
									</td>
									<td class="px-4 py-3 hidden md:table-cell">
										<code class="text-xs bg-sk-bg px-2 py-0.5 rounded">{post.slug}</code>
									</td>
									<td class="px-4 py-3">
										{post.published ? (
											<span class="px-2 py-0.5 rounded text-xs font-medium font-display bg-sk-green-light text-sk-green-dark">Publicado</span>
										) : (
											<span class="px-2 py-0.5 rounded text-xs font-medium font-display bg-sk-yellow-light text-sk-yellow-dark">Rascunho</span>
										)}
									</td>
									<td class="px-4 py-3 hidden md:table-cell text-sk-muted">{post.sections.length}</td>
									<td class="px-4 py-3 hidden md:table-cell text-xs text-sk-muted">{toBrazilDateTime(post.updated_at)}</td>
									<td class="px-4 py-3 text-right">
										<div class="flex items-center justify-end gap-2">
											<button onclick={`uploadImage(${post.id})`} class="text-sk-purple hover:text-sk-purple-dark text-xs font-display font-medium" title="Upload imagem">Img</button>
											<button onclick={`editPost(${post.id})`} class="text-sk-blue hover:text-sk-blue-dark text-xs font-display font-medium">Editar</button>
											<button onclick={`togglePublish(${post.id},${post.published ? 'true' : 'false'})`} class="text-sk-orange hover:text-sk-orange-dark text-xs font-display font-medium">
												{post.published ? "Despublicar" : "Publicar"}
											</button>
											<button onclick={`deletePost(${post.id})`} class="text-sk-danger hover:text-sk-danger-dark text-xs font-display font-medium">Excluir</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* Create/Edit Modal */}
			<div id="modal" class="hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
				<div class="bg-sk-surface rounded-t-sk-xl sm:rounded-sk-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-sk-xl">
					<div class="flex items-center justify-between p-5 border-b border-sk-border/30">
						<h2 id="modal-title" class="font-display font-bold text-lg text-sk-text">Novo Post</h2>
						<button onclick="hideModal()" class="text-sk-muted hover:text-sk-text text-xl">&times;</button>
					</div>
					<form id="blog-form" onsubmit="submitPost(event)" class="p-5 space-y-4">
						<input type="hidden" id="edit-id" />
						<input type="hidden" id="sections-json" value="[]" />

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label class="block text-xs font-display font-medium text-sk-text mb-1">Título</label>
								<input id="f-title" type="text" required onblur="if(!document.getElementById('edit-id').value)generateSlug()" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" />
							</div>
							<div>
								<label class="block text-xs font-display font-medium text-sk-text mb-1">Slug</label>
								<input id="f-slug" type="text" required class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" />
							</div>
						</div>

						<div>
							<label class="block text-xs font-display font-medium text-sk-text mb-1">Descrição (SEO)</label>
							<textarea id="f-description" required rows={2} class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none"></textarea>
						</div>

						<div class="grid grid-cols-3 gap-4">
							<div>
								<label class="block text-xs font-display font-medium text-sk-text mb-1">Ícone</label>
								<input id="f-icon" type="text" value="📝" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm text-center" />
							</div>
							<div>
								<label class="block text-xs font-display font-medium text-sk-text mb-1">Tempo de leitura</label>
								<input id="f-reading-time" type="text" placeholder="5 min de leitura" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm" />
							</div>
							<div class="flex items-end pb-1">
								<label class="flex items-center gap-2 cursor-pointer">
									<input id="f-published" type="checkbox" class="w-4 h-4 rounded" />
									<span class="text-xs font-display font-medium text-sk-text">Publicado</span>
								</label>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-4">
							<div>
								<label class="block text-xs font-display font-medium text-sk-text mb-1">CTA texto</label>
								<input id="f-cta-text" type="text" placeholder="Teste grátis por 30 dias" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm" />
							</div>
							<div>
								<label class="block text-xs font-display font-medium text-sk-text mb-1">CTA link</label>
								<input id="f-cta-href" type="text" placeholder="/landing/#cadastro" class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm" />
							</div>
						</div>

						{/* Sections */}
						<div>
							<div class="flex items-center justify-between mb-2">
								<label class="text-xs font-display font-medium text-sk-text">Seções do artigo</label>
								<button type="button" onclick="addSection()" class="text-xs text-sk-blue hover:text-sk-blue-dark font-display font-medium">+ Adicionar seção</button>
							</div>
							<div id="sections-list" class="space-y-3"></div>
						</div>

						<div class="flex justify-end gap-3 pt-2">
							<button type="button" onclick="hideModal()" class="px-4 py-2.5 rounded-sk text-sm font-display font-medium text-sk-muted hover:text-sk-text transition-colors">Cancelar</button>
							<button id="submit-btn" type="submit" class="bg-sk-blue hover:bg-sk-blue-dark text-white px-6 py-2.5 rounded-sk text-sm font-display font-bold transition-colors shadow-sk-sm">
								<span id="btn-text">Criar post</span>
							</button>
						</div>
					</form>
				</div>
			</div>
		</PlatformLayout>
	);
};
