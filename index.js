const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証トークンがありません。ログインしてください。' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: '不正なトークン、または期限切れです。' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'サーバー内部でエラーが発生しました。' });
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. タイムラインの取得
app.get('/api/posts', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. 新規投稿の作成
app.post('/api/posts', requireAuth, async (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: '内容を入力してください。' });
  }

  const userId = req.user.id;
  const username = req.user.email.split('@')[0];

  try {
    const { data, error } = await supabase
      .from('posts')
      .insert([{ 
        user_id: userId, 
        username: username, 
        content: content 
      }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. 新規登録（【修正】レスポンスをdataオブジェクト直下に集約）
app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    res.status(200).json(data); // { user, session } をそのまま返す
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 4. ログイン（【修正】レスポンスをdataオブジェクト直下に集約）
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    res.status(200).json(data); // { user, session } をそのまま返す
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
