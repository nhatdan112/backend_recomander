const express = require('express');
const jwt = require('jsonwebtoken');
const SearchHistory = require('../models/SearchHistory');

const router = express.Router();

// Middleware để xác thực token
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

// Lấy lịch sử tìm kiếm
router.get('/', authMiddleware, async (req, res) => {
  try {
    const history = await SearchHistory.find({ userId: req.user.userId });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Lưu lịch sử tìm kiếm
router.post('/', authMiddleware, async (req, res) => {
  const { prompt, movies } = req.body;

  try {
    const searchHistory = new SearchHistory({
      userId: req.user.userId,
      prompt,
      movies,
    });
    await searchHistory.save();
    res.json(searchHistory);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

module.exports = router;