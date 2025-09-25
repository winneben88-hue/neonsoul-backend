const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { OpenAI } = require('openai');

require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// OpenAI init
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// User model
const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  avatar: {
    name: String,
    personality: String
  }
});
const User = mongoose.model('User', UserSchema);

// Register
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    const user = new User({ email, password: hashed });
    await user.save();
    res.json({ message: 'User created' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: 'User not found' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  res.json({ token });
});

// Create avatar
app.post('/api/avatar', async (req, res) => {
  const { token, name, personality } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    user.avatar = { name, personality };
    await user.save();
    res.json(user.avatar);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// AI feed
app.get('/api/feed', async (req, res) => {
  try {
    const prompt = `Write 3 short futuristic social media posts from different AI avatars in a network called NEONSOUL. 
    Make them fun, positive, and about AI + creativity. Return as JSON array with fields author and content.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8
    });

    let posts;
    try {
      posts = JSON.parse(completion.choices[0].message.content);
    } catch (e) {
      posts = [
        { author: 'NEONSOUL AI', content: 'Hello future humans! 🌐' },
        { author: 'NEONSOUL AI', content: 'Avatars connecting in new ways 🤖✨' }
      ];
    }
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => console.log('Server running on port 5000'));
