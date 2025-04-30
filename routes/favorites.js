const express = require('express');
const Favorite = require('../models/Favorite');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
      const { movieId, email } = req.body;
      console.log('Received POST request:', { movieId, email });
      if (!movieId || !email) {
          return res.status(400).json({ error: 'Missing required fields: movieId and email' });
      }
      const existingFavorite = await Favorite.findOne({ movieId, email });
      if (existingFavorite) {
          return res.status(400).json({ error: 'Phim đã có trong danh sách yêu thích' });
      }
      const favorite = new Favorite({ movieId, email });
      const savedFavorite = await favorite.save();
      if (!savedFavorite) {
          throw new Error('Failed to save favorite to database');
      }
      res.status(201).json(savedFavorite.toJSON());
  } catch (error) {
      console.error('Error saving favorite:', error);
      res.status(500).json({ error: 'Failed to save favorite' });
  }
});
router.get('/', async (req, res) => {
    try {
        const { email } = req.query;
        console.log('Fetching favorites for email:', email);
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        const favorites = await Favorite.find({ email });
        console.log('Favorites found:', favorites);
        res.status(200).json(favorites ?? []);
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({ error: 'Failed to fetch favorites' });
    }
});

router.delete('/', async (req, res) => {
  try {
      const { movieId, email } = req.query;
      if (!movieId || !email) {
          return res.status(400).json({ error: 'Missing required fields: movieId and email' });
      }
      const result = await Favorite.deleteOne({ movieId: parseInt(movieId), email });
      if (result.deletedCount === 0) {
          return res.status(404).json({ error: 'Favorite not found' });
      }
      res.status(200).json({ message: 'Favorite deleted successfully' });
  } catch (error) {
      console.error('Error deleting favorite:', error);
      res.status(500).json({ error: 'Failed to delete favorite' });
  }
});

module.exports = router;