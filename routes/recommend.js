const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const router = express.Router();

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) {
    return res.status(401).json({ error: 'Không có token, truy cập bị từ chối' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token không hợp lệ' });
  }
};

router.post('/', authMiddleware, async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Vui lòng cung cấp prompt' });
  }

  try {
    // Gọi OpenAI API
    const openAIResponse = await axios.post(
      'https://api.openai.com/v1/completions',
      {
        model: 'text-davinci-003',
        prompt: `Gợi ý 5 phim dựa trên: ${prompt}. Trả về danh sách dạng: "1. Tên phim\n2. Tên phim\n..."`,
        max_tokens: 100,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const result = openAIResponse.data.choices[0].text;
    const movieTitles = result
      .split('\n')
      .map((line) => line.replaceAll(/^\d+\.\s*/, '').trim())
      .filter((title) => title);

    // Gọi TMDb API để lấy chi tiết phim
    const movies = [];
    for (const title of movieTitles) {
      const tmdbResponse = await axios.get(
        `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(title)}`
      );
      const movie = tmdbResponse.data.results[0];
      if (movie) {
        movies.push({
          id: movie.id,
          title: movie.title,
          overview: movie.overview,
          poster_path: movie.poster_path,
          vote_average: movie.vote_average,
        });
      }
    }

    // Lưu lịch sử tìm kiếm
    const searchHistory = new (require('../models/SearchHistory'))({
      userId: req.user.userId,
      prompt,
      movies,
    });
    await searchHistory.save();

    res.json(movies);
  } catch (error) {
    console.error('Error recommending movies:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

module.exports = router;