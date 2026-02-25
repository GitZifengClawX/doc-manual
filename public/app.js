// API 请求工具
const API = {
    async get(url) {
        const res = await fetch(url);
        return res.json();
    },
    
    async post(url, data) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    
    async postForm(url, formData) {
        const res = await fetch(url, {
            method: 'POST',
            body: formData
        });
        return res.json();
    },
    
    async put(url, data) {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    
    async delete(url) {
        const res = await fetch(url, { method: 'DELETE' });
        return res.json();
    }
};

// 页面状态
let currentUser = null;
let currentDocs = [];
let currentCategory = 'all';

// 初始化
async function init() {
    await checkAuth();
    if (currentUser) {
        showAdmin();
    } else {
        showHome();
    }
}

// 检查登录状态
async function checkAuth() {
    try {
        const data = await API.get('/api/auth');
        if (data.loggedIn) {
            currentUser = data.user;
            updateNav(true);
        }
    } catch (e) {
        console.error('检查登录状态失败', e);
    }
}

// 更新导航栏
function updateNav(loggedIn) {
    document.getElementById('nav-login').style.display = loggedIn ? 'none' : 'inline';
    document.getElementById('nav-admin').style.display = loggedIn ? 'inline' : 'none';
    document.getElementById('nav-logout').style.display = loggedIn ? 'inline' : 'none';
}

// 显示首页
async function showHome() {
    hideAllSections();
    document.getElementById('home-section').style.display = 'block';
    
    try {
        currentDocs = await API.get('/api/docs');
        renderDocsList();
    } catch (e) {
        console.error('获取文档失败', e);
    }
}

// 按分类筛选
function filterByCategory(category) {
    currentCategory = category;
    
    // 更新标签样式
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.category === category) {
            tab.classList.add('active');
        }
    });
    
    renderDocsList();
}

// 渲染文档列表
function renderDocsList() {
    const container = document.getElementById('docs-container');
    let filteredDocs = currentDocs;
    
    // 按分类筛选
    if (currentCategory !== 'all') {
        filteredDocs = currentDocs.filter(d => d.category === currentCategory);
    }
    
    if (filteredDocs.length === 0) {
        container.innerHTML = '<p class="no-data">暂无文档</p>';
        return;
    }
    
    // 按更新时间排序
    filteredDocs.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    
    container.innerHTML = filteredDocs.map(doc => `
        <div class="doc-card" onclick="viewDoc(${doc.id})">
            <h3>${escapeHtml(doc.title)}</h3>
            <span class="category-tag category-${doc.category}">${escapeHtml(doc.category)}</span>
            <p class="date">${formatDate(doc.createdAt)}</p>
        </div>
    `).join('');
}

// 查看文档
async function viewDoc(id) {
    try {
        const doc = await API.get(`/api/docs/${id}`);
        hideAllSections();
        document.getElementById('doc-section').style.display = 'block';
        document.getElementById('doc-content').innerHTML = renderMarkdown(doc.content);
        document.getElementById('doc-content').dataset.docId = id;
    } catch (e) {
        alert('获取文档失败');
    }
}

// 显示登录
function showLogin() {
    hideAllSections();
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('login-error').textContent = '';
}

// 登录
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const data = await API.post('/api/login', { username, password });
        if (data.success) {
            currentUser = data.user;
            updateNav(true);
            showAdmin();
        } else {
            document.getElementById('login-error').textContent = data.error;
        }
    } catch (e) {
        document.getElementById('login-error').textContent = '登录失败，请稍后重试';
    }
}

// 退出登录
async function logout() {
    await API.post('/api/logout');
    currentUser = null;
    updateNav(false);
    showHome();
}

// 显示管理后台
async function showAdmin() {
    if (!currentUser) {
        showLogin();
        return;
    }
    
    hideAllSections();
    document.getElementById('admin-section').style.display = 'block';
    await loadAdminDocs();
}

// 加载管理文档列表
async function loadAdminDocs() {
    try {
        currentDocs = await API.get('/api/docs');
        renderAdminDocs();
    } catch (e) {
        console.error('获取文档失败', e);
    }
}

// 渲染管理文档列表
function renderAdminDocs() {
    const tbody = document.getElementById('admin-docs-tbody');
    
    // 按更新时间排序
    const sortedDocs = [...currentDocs].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    
    if (sortedDocs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">暂无文档</td></tr>';
        return;
    }
    
    tbody.innerHTML = sortedDocs.map(doc => `
        <tr>
            <td>${escapeHtml(doc.title)}</td>
            <td><span class="category-tag category-${doc.category}">${escapeHtml(doc.category)}</span></td>
            <td>${formatDate(doc.updatedAt || doc.createdAt)}</td>
            <td class="actions">
                <button class="btn-edit" onclick="editDoc(${doc.id})">编辑</button>
                <button class="btn-delete" onclick="deleteDoc(${doc.id})">删除</button>
            </td>
        </tr>
    `).join('');
}

// 显示文档编辑器
function showDocEditor(doc = null) {
    const editor = document.getElementById('doc-editor');
    const title = document.getElementById('editor-title');
    const idInput = document.getElementById('edit-doc-id');
    const titleInput = document.getElementById('doc-title');
    const categoryInput = document.getElementById('doc-category');
    const contentInput = document.getElementById('doc-content');
    
    if (doc) {
        title.textContent = '编辑文档';
        idInput.value = doc.id;
        titleInput.value = doc.title;
        categoryInput.value = doc.category || '技术类';
        contentInput.value = doc.content;
    } else {
        title.textContent = '新建文档';
        idInput.value = '';
        titleInput.value = '';
        categoryInput.value = '技术类';
        contentInput.value = '';
    }
    
    editor.style.display = 'flex';
}

// 隐藏文档编辑器
function hideDocEditor() {
    document.getElementById('doc-editor').style.display = 'none';
}

// 插入图片
async function insertImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            const data = await API.postForm('/api/admin/upload', formData);
            if (data.success) {
                // 插入图片 Markdown
                const textarea = document.getElementById('doc-content');
                const imgMarkdown = `![${file.name}](${data.url})`;
                insertAtCursor(textarea, '\n' + imgMarkdown + '\n');
            } else {
                alert('上传失败: ' + (data.error || '未知错误'));
            }
        } catch (err) {
            alert('上传失败，请重试');
        }
    };
    
    input.click();
}

// 在光标位置插入文本
function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    textarea.value = value.substring(0, start) + text + value.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
}

// 粘贴图片
document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('doc-content');
    if (!textarea) return;
    
    textarea.addEventListener('paste', async (e) => {
        const items = e.clipboardData.items;
        for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = item.getAsFile();
                
                const formData = new FormData();
                formData.append('image', file);
                
                try {
                    const data = await API.postForm('/api/admin/upload', formData);
                    if (data.success) {
                        const imgMarkdown = `![image](${data.url})`;
                        insertAtCursor(textarea, '\n' + imgMarkdown + '\n');
                    }
                } catch (err) {
                    console.error('粘贴图片上传失败', err);
                }
                break;
            }
        }
    });
});

// 编辑文档
async function editDoc(id) {
    const doc = currentDocs.find(d => d.id === id);
    if (doc) {
        showDocEditor(doc);
    }
}

// 保存文档
async function saveDoc(e) {
    e.preventDefault();
    
    const id = document.getElementById('edit-doc-id').value;
    const title = document.getElementById('doc-title').value;
    const category = document.getElementById('doc-category').value;
    const content = document.getElementById('doc-content').value;
    
    try {
        if (id) {
            // 更新
            await API.put(`/api/admin/docs/${id}`, { title, category, content });
            alert('文档已更新，将自动提交到 GitHub');
        } else {
            // 创建
            await API.post('/api/admin/docs', { title, category, content });
            alert('文档已创建，将自动提交到 GitHub');
        }
        
        hideDocEditor();
        await loadAdminDocs();
    } catch (e) {
        alert('保存失败');
    }
}

// 删除文档
async function deleteDoc(id) {
    if (!confirm('确定要删除这篇文档吗？')) return;
    
    try {
        await API.delete(`/api/admin/docs/${id}`);
        await loadAdminDocs();
        alert('文档已删除，将自动从 GitHub 移除');
    } catch (e) {
        alert('删除失败');
    }
}

// 隐藏所有区块
function hideAllSections() {
    document.getElementById('home-section').style.display = 'none';
    document.getElementById('doc-section').style.display = 'none';
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('admin-section').style.display = 'none';
}

// 简单 Markdown 渲染（增强图片支持）
function renderMarkdown(text) {
    if (!text) return '';
    
    let html = escapeHtml(text);
    
    // 标题
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // 粗体和斜体
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // 代码块
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // 图片（增强：支持本地图片）
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="md-image" onclick="window.open(this.src)">');
    
    // 引用
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    
    // 列表
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // 水平线
    html = html.replace(/^---$/gm, '<hr>');
    
    // 换行
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    
    // 清理空段落
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<pre>)/g, '$1');
    html = html.replace(/(<\/pre>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p>(<blockquote>)/g, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
    html = html.replace(/<p>(<hr>)<\/p>/g, '$1');
    
    return html;
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 格式化日期
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// 启动
init();
