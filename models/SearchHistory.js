const mongoose = require('mongoose');

// Định nghĩa schema
const searchHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  prompt: { type: String },
  movies: [
    {
      id: Number,
      title: String,
      description: String,
      poster: String,
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

// Kiểm tra xem model đã được định nghĩa chưa
module.exports = mongoose.models.SearchHistory || mongoose.model('SearchHistory', searchHistorySchema);