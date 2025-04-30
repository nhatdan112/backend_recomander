const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const SearchHistory = require('../models/SearchHistory');
const Favorite = require('../models/Favorite');
const User = require('../models/User');

// Đăng ký người dùng
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
    }

    // Kiểm tra email đã tồn tại
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email đã được sử dụng' });
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword, name });
    await newUser.save();

    // Tạo JWT token
    const token = jwt.sign({ userId: newUser._id }, 'secret_key', { expiresIn: '1h' });
    res.status(201).json({ token, user: { email: newUser.email, name: newUser.name } });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi đăng ký: ' + error.message });
  }
});

// Đăng nhập
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Email không tồn tại' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Mật khẩu không đúng' });
    }

    const token = jwt.sign({ userId: user._id }, 'secret_key', { expiresIn: '1h' });
    res.status(200).json({ token, user: { email: user.email, name: user.name } });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi đăng nhập: ' + error.message });
  }
});

// Gửi OTP (mô phỏng - trong thực tế cần tích hợp SMS API như Twilio)
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email là bắt buộc' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Email không tồn tại' });
    }

    // Mô phỏng OTP (trong thực tế, gửi qua SMS hoặc email)
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // OTP 6 chữ số
    // Lưu OTP vào database (có thể thêm trường otp và otpExpires vào schema User)
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // Hết hạn sau 10 phút
    await user.save();

    // Mô phỏng gửi OTP (in ra console)
    console.log(`OTP cho ${email}: ${otp}`);
    res.status(200).json({ message: 'OTP đã được gửi', verificationId: user._id });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi gửi OTP: ' + error.message });
  }
});

// Xác thực OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { verificationId, otp } = req.body;
    if (!verificationId || !otp) {
      return res.status(400).json({ error: 'Verification ID và OTP là bắt buộc' });
    }

    const user = await User.findById(verificationId);
    if (!user) {
      return res.status(400).json({ error: 'Người dùng không tồn tại' });
    }

    if (user.otp !== otp || Date.now() > user.otpExpires) {
      return res.status(400).json({ error: 'OTP không hợp lệ hoặc đã hết hạn' });
    }

    // Xóa OTP sau khi xác thực
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = jwt.sign({ userId: user._id }, 'secret_key', { expiresIn: '1h' });
    res.status(200).json({ token, user: { email: user.email, name: user.name } });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi xác thực OTP: ' + error.message });
  }
});

// Middleware xác thực JWT
const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Không có token' });

  try {
    const decoded = jwt.verify(token, 'secret_key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token không hợp lệ' });
  }
};

// Đăng xuất
router.post('/logout', authMiddleware, (req, res) => {
  try {
    // Token đã được xác thực bởi authMiddleware
    // Phía client sẽ xóa token, nên ở đây chỉ trả về thông báo thành công
    res.status(200).json({ message: 'Đăng xuất thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi đăng xuất: ' + error.message });
  }
});

// Các API đã có từ trước (SearchHistory và Favorites) - bảo vệ bằng authMiddleware
router.post('/search-history', authMiddleware, async (req, res) => {
  try {
    const { prompt, movies } = req.body;
    const newSearch = new SearchHistory({ prompt, movies });
    await newSearch.save();
    res.status(201).json(newSearch);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lưu lịch sử tìm kiếm' });
  }
});

router.get('/search-history', authMiddleware, async (req, res) => {
  try {
    const history = await SearchHistory.find().sort({ createdAt: -1 });
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lấy lịch sử tìm kiếm' });
  }
});

module.exports = router;