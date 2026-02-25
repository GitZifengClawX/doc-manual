const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// 数据文件路径
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DOCS_FILE = path.join(DATA_DIR, 'docs.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化数据文件
if (!fs.existsSync(USERS_FILE)) {
    const defaultUsers = [
        { id: 1, username: 'admin', password: bcrypt.hashSync('admin123', 10), role: 'admin' }
    ];
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
}

if (!fs.existsSync(DOCS_FILE)) {
    const defaultDocs = [
        { id: 1, title: '欢迎使用', content: '# 欢迎使用在线文档手册\n\n这是您的第一个文档页面。\n\n## 功能说明\n\n- 前台浏览文档\n- 管理员后台编辑\n- 支持 Markdown 格式', category: '首页', createdAt: new Date().toISOString() },
        { id: 2, title: '使用指南', content: '# 使用指南\n\n本文档帮助您快速上手系统。', category: '指南', createdAt: new Date().toISOString() }
    ];
    fs.writeFileSync(DOCS_FILE, JSON.stringify(defaultDocs, null, 2));
}

// 中间件
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'doc-manual-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24小时
}));

// 工具函数
function getUsers() {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function getDocs() {
    return JSON.parse(fs.readFileSync(DOCS_FILE, 'utf-8'));
}

function saveDocs(docs) {
    fs.writeFileSync(DOCS_FILE, JSON.stringify(docs, null, 2));
}

// 认证中间件
function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: '请先登录' });
    }
}

function requireAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: '需要管理员权限' });
    }
}

// ============ 公开 API ============

// 获取所有文档（前台浏览）
app.get('/api/docs', (req, res) => {
    const docs = getDocs();
    res.json(docs.map(d => ({ id: d.id, title: d.title, category: d.category, createdAt: d.createdAt })));
});

// 获取单个文档详情
app.get('/api/docs/:id', (req, res) => {
    const docs = getDocs();
    const doc = docs.find(d => d.id === parseInt(req.params.id));
    if (doc) {
        res.json(doc);
    } else {
        res.status(404).json({ error: '文档不存在' });
    }
});

// 登录
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = getUsers();
    const user = users.find(u => u.username === username);
    
    if (user && bcrypt.compareSync(password, user.password)) {
        req.session.user = { id: user.id, username: user.username, role: user.role };
        res.json({ success: true, user: { username: user.username, role: user.role } });
    } else {
        res.status(401).json({ error: '用户名或密码错误' });
    }
});

// 退出登录
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// 获取当前登录状态
app.get('/api/auth', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// ============ 管理员 API ============

// 创建文档
app.post('/api/admin/docs', requireAdmin, (req, res) => {
    const { title, content, category } = req.body;
    const docs = getDocs();
    const newDoc = {
        id: Date.now(),
        title,
        content: content || '',
        category: category || '未分类',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    docs.push(newDoc);
    saveDocs(docs);
    res.json(newDoc);
});

// 更新文档
app.put('/api/admin/docs/:id', requireAdmin, (req, res) => {
    const docs = getDocs();
    const index = docs.findIndex(d => d.id === parseInt(req.params.id));
    if (index === -1) {
        return res.status(404).json({ error: '文档不存在' });
    }
    docs[index] = {
        ...docs[index],
        ...req.body,
        updatedAt: new Date().toISOString()
    };
    saveDocs(docs);
    res.json(docs[index]);
});

// 删除文档
app.delete('/api/admin/docs/:id', requireAdmin, (req, res) => {
    let docs = getDocs();
    const index = docs.findIndex(d => d.id === parseInt(req.params.id));
    if (index === -1) {
        return res.status(404).json({ error: '文档不存在' });
    }
    docs.splice(index, 1);
    saveDocs(docs);
    res.json({ success: true });
});

// 获取所有分类
app.get('/api/admin/categories', requireAdmin, (req, res) => {
    const docs = getDocs();
    const categories = [...new Set(docs.map(d => d.category))];
    res.json(categories);
});

// 修改密码
app.post('/api/admin/password', requireAdmin, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === req.session.user.id);
    
    if (!bcrypt.compareSync(oldPassword, users[userIndex].password)) {
        return res.status(400).json({ error: '原密码错误' });
    }
    
    users[userIndex].password = bcrypt.hashSync(newPassword, 10);
    saveUsers(users);
    res.json({ success: true });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`文档手册系统已启动: http://localhost:${PORT}`);
    console.log('默认管理员账号: admin / admin123');
});
