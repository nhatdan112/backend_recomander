const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const searchHistoryRoutes = require('./routes/searchHistory');
const favoritesRoutes = require('./routes/favorites');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan'); // For request logging

// Load environment variables
dotenv.config();

// Validate critical environment variables
const requiredEnvVars = ['JWT_SECRET', 'TMDB_API_KEY', 'MONGO_URI'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: ${envVar} is not defined in .env`);
    process.exit(1);
  }
}

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev')); // Log HTTP requests for debugging

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and GIF images are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expect "Bearer <token>"
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Routes
app.use('/api/auth', authRoutes); // Authentication routes (login, register, etc.)
app.use('/api/search-history', searchHistoryRoutes);
app.use('/api/favorites', favoritesRoutes);

// Image upload endpoint
app.post('/api/upload-image', authenticateToken, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (error) {
    res.status(500).json({ error: `Failed to upload image: ${error.message}` });
  }
});

// Serve uploaded images
app.use('/uploads', express.static('uploads'));

// User profile endpoints
app.get('/api/user/profile-by-email', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const user = await User.findOne({ email }).select('name email avatar');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      name: user.name,
      email: user.email,
      avatar: user.avatar || 'https://via.placeholder.com/150',
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch user profile: ${error.message}` });
  }
});

app.put('/api/user/update-by-email', async (req, res) => {
  try {
    const { email } = req.query;
    const { name, avatar } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (name) user.name = name;
    if (avatar) user.avatar = avatar;
    await user.save();
    res.json({
      message: 'Profile updated successfully',
      user: {
        name: user.name,
        email: user.email,
        avatar: user.avatar || 'https://via.placeholder.com/150',
      },
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to update profile: ${error.message}` });
  }
});

app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('name email avatar');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      name: user.name,
      email: user.email,
      avatar: user.avatar || 'https://via.placeholder.com/150',
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch user profile: ${error.message}` });
  }
});

app.put('/api/user/update', authenticateToken, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (name) user.name = name;
    if (avatar) user.avatar = avatar;
    await user.save();
    res.json({
      message: 'Profile updated successfully',
      user: {
        name: user.name,
        email: user.email,
        avatar: user.avatar || 'https://via.placeholder.com/150',
      },
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to update profile: ${error.message}` });
  }
});

// TMDb API proxy endpoints
app.get('/api/popular-movies', async (req, res) => {
  const page = req.query.page || 1;
  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/popular?api_key=${process.env.TMDB_API_KEY}&page=${page}`
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch popular movies: ${error.message}` });
  }
});

app.get('/api/search-movies', async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }
  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: `Failed to search movies: ${error.message}` });
  }
});

app.get('/api/movie/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=videos,images`
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch movie details: ${error.message}` });
  }
});

// Movie recommendation endpoint
app.post('/api/recommend-movies', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  try {
    const nlpResponse = await axios.post('http://localhost:5000/generate', {
      prompt: `Dựa trên yêu cầu: "${prompt}". Gợi ý 5 phim khác nhau. Trả về danh sách dạng: "1. Tên phim\n2. Tên phim\n3. Tên phim\n4. Tên phim\n5. Tên phim". Chỉ trả về danh sách phim, không thêm thông tin khác. Ví dụ:\n1. The Notebook\n2. La La Land\n3. Before Sunrise\n4. The Fault in Our Stars\n5. Me Before You`,
    });
    const generatedText = nlpResponse.data.generated_text;
    const movieTitles = generatedText
      .split('\n')
      .map((line) => line.replace(/^\d+\.\s*/, '').trim())
      .filter((title) => title.length > 0 && !title.includes('Gợi ý') && !title.includes('Ví dụ'))
      .slice(0, 5);
    const movies = [];
    for (const title of movieTitles) {
      try {
        const response = await axios.get(
          `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(title)}&page=1`
        );
        if (response.data.results && response.data.results.length > 0) {
          movies.push(response.data.results[0]);
        }
      } catch (error) {
        console.error(`Error searching for movie "${title}":`, error.message);
      }
    }
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: `Failed to generate movie recommendations: ${error.message}` });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Multer error: ${err.message}` });
  }
  console.error('Server error:', err);
  res.status(500).json({ error: `Internal server error: ${err.message}` });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});